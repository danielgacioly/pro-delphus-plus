import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toQuoteDTO } from '../lib/dto.js'

export const clientsRouter = Router()

clientsRouter.use(requireAuth)

const clientBodySchema = z.object({
  kind: z.enum(['INDIVIDUAL', 'INSTITUTION', 'DISTRIBUTOR']).default('INDIVIDUAL'),
  prefix: z.enum(['NONE', 'MR', 'MS']).default('NONE'),
  name: z.string().min(1, 'Informe o nome do cliente'),
  institution: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  billToText: z.string().optional(),
  shipToText: z.string().optional(),
  sectors: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
})

/** Campos de texto vazios viram null para não poluir o cadastro com strings em branco. */
function normalize<T extends Record<string, unknown>>(data: T) {
  const out: Record<string, unknown> = { ...data }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && v.trim() === '') out[k] = null
  }
  return out as T
}

interface ClientAggregate {
  clientId: string
  quoteCount: number
  orderCount: number
  totalQuoted: string
  lastQuoteAt: Date | null
}

/**
 * Agregados de todos os clientes numa consulta só. Pedidos são contados via
 * orçamento, já que Order não referencia Client diretamente.
 */
async function loadAggregates(): Promise<Map<string, ClientAggregate>> {
  const rows = await prisma.$queryRaw<
    { clientId: string; quoteCount: bigint; orderCount: bigint; totalQuoted: string | null; lastQuoteAt: Date | null }[]
  >`
    SELECT q."clientId",
           count(*)                                   AS "quoteCount",
           count(o.id)                                AS "orderCount",
           COALESCE(sum(q.total), 0)::text            AS "totalQuoted",
           max(q."createdAt")                         AS "lastQuoteAt"
    FROM quotes q
    LEFT JOIN orders o ON o."quoteId" = q.id
    WHERE q."clientId" IS NOT NULL
    GROUP BY q."clientId"
  `
  return new Map(
    rows.map((r) => [
      r.clientId,
      {
        clientId: r.clientId,
        quoteCount: Number(r.quoteCount),
        orderCount: Number(r.orderCount),
        totalQuoted: r.totalQuoted ?? '0',
        lastQuoteAt: r.lastQuoteAt,
      },
    ]),
  )
}

type ClientRow = Awaited<ReturnType<typeof prisma.client.findMany>>[number]

function toClientDTO(client: ClientRow, agg?: ClientAggregate) {
  return {
    id: client.id,
    kind: client.kind,
    prefix: client.prefix,
    name: client.name,
    institution: client.institution,
    email: client.email,
    phone: client.phone,
    taxId: client.taxId,
    website: client.website,
    country: client.country,
    state: client.state,
    city: client.city,
    billToText: client.billToText,
    shipToText: client.shipToText,
    sectors: client.sectors,
    notes: client.notes,
    active: client.active,
    createdAt: client.createdAt.toISOString(),
    stats: {
      quoteCount: agg?.quoteCount ?? 0,
      orderCount: agg?.orderCount ?? 0,
      totalQuoted: agg?.totalQuoted ?? '0',
      lastQuoteAt: agg?.lastQuoteAt?.toISOString() ?? null,
    },
  }
}

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { institution: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { country: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    })
    const aggregates = await loadAggregates()
    res.json({ clients: clients.map((c) => toClientDTO(c, aggregates.get(c.id))) })
  }),
)

clientsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } })
    if (!client) throw new HttpError(404, 'Cliente não encontrado')

    const quotes = await prisma.quote.findMany({
      where: { clientId: client.id },
      include: {
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { country: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const orders = await prisma.order.findMany({
      where: { quote: { clientId: client.id } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        quote: { select: { quoteNumber: true, total: true, currency: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const aggregates = await loadAggregates()
    res.json({
      client: toClientDTO(client, aggregates.get(client.id)),
      quotes: quotes.map(toQuoteDTO),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        quoteNumber: o.quote.quoteNumber,
        total: o.quote.total.toString(),
        currency: o.quote.currency,
      })),
    })
  }),
)

clientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = normalize(clientBodySchema.parse(req.body))
    const client = await prisma.client.create({
      data: { ...data, createdById: req.user!.id },
    })
    res.status(201).json({ client: toClientDTO(client) })
  }),
)

clientsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = normalize(clientBodySchema.partial().parse(req.body))
    const existing = await prisma.client.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Cliente não encontrado')

    const client = await prisma.client.update({ where: { id: req.params.id }, data })
    const aggregates = await loadAggregates()
    res.json({ client: toClientDTO(client, aggregates.get(client.id)) })
  }),
)

clientsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { quotes: true } } },
    })
    if (!client) throw new HttpError(404, 'Cliente não encontrado')

    // Orçamento emitido é documento: em vez de apagar o cliente e perder o
    // vínculo, desativa e mantém o histórico navegável.
    if (client._count.quotes > 0) {
      const updated = await prisma.client.update({ where: { id: client.id }, data: { active: false } })
      const aggregates = await loadAggregates()
      res.json({ client: toClientDTO(updated, aggregates.get(updated.id)), deactivated: true })
      return
    }

    await prisma.client.delete({ where: { id: client.id } })
    res.status(204).send()
  }),
)
