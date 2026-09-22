import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toQuoteDTO, toClientDTO, type ClientAggregate } from '../lib/dto.js'

export const clientsRouter = Router()

clientsRouter.use(requireAuth)

// `kind`/`prefix` NÃO usam `.default(...)` aqui de propósito: esse schema
// também vira `.partial()` pro PATCH (edição parcial, ex. o toggle de "em
// atendimento", que manda só `{ inService }`), e o `.default()` do Zod é
// aplicado mesmo quando o campo não veio no partial — na prática, qualquer
// PATCH que não mandasse `kind`/`prefix` resetava silenciosamente o cliente
// pra "Pessoa"/"Sem tratamento". O valor padrão do create fica explícito no
// POST, abaixo.
export const clientBodySchema = z.object({
  kind: z.enum(['INDIVIDUAL', 'INSTITUTION', 'DISTRIBUTOR']).optional(),
  prefix: z.enum(['NONE', 'MR', 'MS']).optional(),
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
  inService: z.boolean().optional(),
})

/** Campos de texto vazios viram null para não poluir o cadastro com strings em branco. */
function normalize<T extends Record<string, unknown>>(data: T) {
  const out: Record<string, unknown> = { ...data }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && v.trim() === '') out[k] = null
  }
  return out as T
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

export async function createClientRecord(data: z.infer<typeof clientBodySchema>, createdById: string) {
  const normalized = normalize(clientBodySchema.parse(data))
  return prisma.client.create({
    data: { ...normalized, kind: normalized.kind ?? 'INDIVIDUAL', prefix: normalized.prefix ?? 'NONE', createdById },
  })
}

clientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const client = await createClientRecord(req.body, req.user!.id)
    res.status(201).json({ client: toClientDTO(client) })
  }),
)

export async function updateClientRecord(id: string, data: Partial<z.infer<typeof clientBodySchema>>) {
  const normalized = normalize(clientBodySchema.partial().parse(data))
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Cliente não encontrado')

  const client = await prisma.client.update({ where: { id }, data: normalized })
  const aggregates = await loadAggregates()
  return { client, aggregate: aggregates.get(client.id) }
}

clientsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { client, aggregate } = await updateClientRecord(req.params.id, req.body)
    res.json({ client: toClientDTO(client, aggregate) })
  }),
)

clientsRouter.delete(
  '/:id',
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
