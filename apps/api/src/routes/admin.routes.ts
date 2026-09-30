import { Router } from 'express'
import { z } from 'zod'
import {
  findPriceTable,
  PRICE_ADJUSTMENT_MAX_PERCENT,
  PRICE_ADJUSTMENT_MIN_PERCENT,
  PRICE_TABLES,
  type PriceAdjustmentDTO,
} from '@prodelphusplus/shared'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'

/** Painel do ADM — ações que mexem no sistema inteiro de uma vez. */
export const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('ADMIN'))

type AdjustmentRow = Awaited<ReturnType<typeof listAdjustments>>[number]

function listAdjustments() {
  return prisma.priceAdjustment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { createdBy: { select: { name: true } } },
  })
}

function toPriceAdjustmentDTO(a: AdjustmentRow): PriceAdjustmentDTO {
  return {
    id: a.id,
    priceTable: a.priceTable,
    percent: Number(a.percent),
    productCount: a.productCount,
    createdAt: a.createdAt.toISOString(),
    createdByName: a.createdBy?.name ?? null,
  }
}

adminRouter.get(
  '/price-adjustments',
  asyncHandler(async (_req, res) => {
    res.json({ adjustments: (await listAdjustments()).map(toPriceAdjustmentDTO) })
  }),
)

/** Linhas usadas como exemplo na prévia do reajuste — as que a equipe conhece de cor. */
const SAMPLE_PRODUCTS = ['THOR', 'LARS', 'MMT']

/**
 * Prévia do reajuste: quantos produtos têm preço na tabela (a mesma contagem
 * que o reajuste vai usar, inativos inclusive) e alguns exemplos, pra quem
 * confirma ver antes o tamanho do que vai mudar.
 */
adminRouter.get(
  '/price-adjustments/preview',
  asyncHandler(async (req, res) => {
    const table = findPriceTable(z.string().parse(req.query.priceTable))
    if (!table) throw new HttpError(400, 'Tabela de preço desconhecida')
    const where = { [table.column]: { not: null } }
    const [productCount, candidates, fallback] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where: { ...where, active: true, OR: SAMPLE_PRODUCTS.map((name) => ({ name: { startsWith: name, mode: 'insensitive' as const } })) },
      }),
      prisma.product.findMany({ where: { ...where, active: true }, orderBy: { name: 'asc' }, take: SAMPLE_PRODUCTS.length }),
    ])
    // Um de cada linha conhecida — o modelo completo, de preferência o de
    // nome exato ("THOR", não "THOR-P" nem a peça "THOR-0"). Linha sem preço
    // nesta tabela cede o lugar ao primeiro do catálogo em ordem alfabética.
    const samples = SAMPLE_PRODUCTS.map((line) =>
      candidates
        .filter((p) => p.name.toUpperCase().startsWith(line))
        .toSorted(
          (a, b) =>
            Number(b.kind === 'COMPLETE_MODEL') - Number(a.kind === 'COMPLETE_MODEL') ||
            Number(b.name.toUpperCase() === line) - Number(a.name.toUpperCase() === line) ||
            a.name.length - b.name.length,
        )[0],
    ).filter((p) => p !== undefined)
    for (const p of fallback) {
      if (samples.length >= SAMPLE_PRODUCTS.length) break
      if (!samples.some((s) => s.name === p.name)) samples.push(p)
    }
    res.json({
      productCount,
      samples: samples.map((p) => ({ name: p.name, sku: p.sku, price: Number(p[table.column]) })),
    })
  }),
)

const adjustmentSchema = z.object({
  priceTable: z.enum(PRICE_TABLES.map((t) => t.key) as [string, ...string[]]),
  percent: z.coerce
    .number()
    .min(PRICE_ADJUSTMENT_MIN_PERCENT)
    .max(PRICE_ADJUSTMENT_MAX_PERCENT)
    .refine((p) => p !== 0, 'Reajuste de 0% não muda nada')
    // O histórico guarda duas casas decimais; mais que isso não chegaria
    // igual ao registro (tolerância por ponto flutuante: 1.1 * 100 dá 110.00000000000001).
    .refine((p) => Math.abs(Math.round(p * 100) - p * 100) < 1e-6, 'Use no máximo duas casas decimais'),
})

/**
 * Reajusta, de forma permanente, todos os preços de uma tabela: cada produto
 * com preço nela passa a valer preço × (1 + %/100), em centavos (a coluna é
 * numeric(12,2) — o próprio Postgres arredonda). Orçamentos e pedidos já
 * gerados não mudam: guardam o preço do item na hora em que foram feitos.
 */
adminRouter.post(
  '/price-adjustments',
  asyncHandler(async (req, res) => {
    const { priceTable, percent } = adjustmentSchema.parse(req.body)
    const table = findPriceTable(priceTable)
    if (!table) throw new HttpError(400, 'Tabela de preço desconhecida')
    const factor = 1 + percent / 100

    const adjustment = await prisma.$transaction(async (tx) => {
      const { count } = await tx.product.updateMany({
        where: { [table.column]: { not: null } },
        data: { [table.column]: { multiply: factor }, updatedById: req.user!.id },
      })
      return tx.priceAdjustment.create({
        data: { priceTable, percent, productCount: count, createdById: req.user!.id },
        include: { createdBy: { select: { name: true } } },
      })
    })
    res.status(201).json({ adjustment: toPriceAdjustmentDTO(adjustment) })
  }),
)
