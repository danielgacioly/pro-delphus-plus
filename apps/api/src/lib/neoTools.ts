import { prisma } from './prisma.js'
import { toClientDTO } from './dto.js'
import { createQuoteSchema, resolveQuoteData, type CreateQuoteInput } from '../routes/quotes.routes.js'
import { orderFieldsSchema, type OrderFieldsInput } from '../routes/orders.routes.js'
import { createPendingAction } from './neoPendingActions.js'
import { HttpError } from '../middleware/errorHandler.js'

function productSummary(p: {
  id: string
  sku: string
  name: string
  kind: string
  sectors: string[]
  priceBRL: unknown
  priceUSD: unknown
  priceUSDDistributor: unknown
  priceEUR: unknown
}) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    kind: p.kind,
    sectors: p.sectors,
    priceBRL: p.priceBRL?.toString() ?? null,
    priceUSD: p.priceUSD?.toString() ?? null,
    priceUSDDistributor: p.priceUSDDistributor?.toString() ?? null,
    priceEUR: p.priceEUR?.toString() ?? null,
  }
}

export async function buscarProdutos(args: { setores?: string[]; texto?: string }) {
  const { setores, texto } = args
  const products = await prisma.product.findMany({
    where: {
      active: true,
      AND: [
        setores && setores.length > 0 ? { sectors: { hasSome: setores } } : {},
        texto
          ? {
              OR: [
                { name: { contains: texto, mode: 'insensitive' } },
                { description: { contains: texto, mode: 'insensitive' } },
                { descriptionPt: { contains: texto, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    take: 15,
    orderBy: { name: 'asc' },
  })
  return products.map(productSummary)
}

export async function listarClientes(args: { filtro?: string; setor?: string; emAtendimento?: boolean }) {
  const { filtro, setor, emAtendimento } = args
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      AND: [
        filtro
          ? { OR: [{ name: { contains: filtro, mode: 'insensitive' } }, { institution: { contains: filtro, mode: 'insensitive' } }] }
          : {},
        setor ? { sectors: { has: setor } } : {},
        emAtendimento !== undefined ? { inService: emAtendimento } : {},
      ],
    },
    take: 20,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function buscarCliente(args: { nome: string }) {
  const clients = await prisma.client.findMany({
    where: { name: { contains: args.nome, mode: 'insensitive' } },
    take: 5,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function listarSetores() {
  return prisma.sector.findMany({ select: { name: true, namePt: true }, orderBy: { name: 'asc' } })
}

function money(currency: string, value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

export async function proporOrcamento(args: CreateQuoteInput, userId: string) {
  const data = createQuoteSchema.parse(args)
  const resolved = await resolveQuoteData(data, userId)
  const summary = `Orçamento novo para ${data.clientName}, ${resolved.lineItems.length} item(ns), total ${money(resolved.currency, resolved.total)}.`
  const pendingAction = createPendingAction('orcamento_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoOrcamento(args: { orcamentoId: string } & CreateQuoteInput, userId: string) {
  const { orcamentoId, ...rest } = args
  const data = createQuoteSchema.parse(rest)
  const resolved = await resolveQuoteData(data, userId)
  const summary = `Edição do orçamento — ${resolved.lineItems.length} item(ns), novo total ${money(resolved.currency, resolved.total)}.`
  const pendingAction = createPendingAction('orcamento_editar', summary, { orcamentoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporPedido(args: Partial<OrderFieldsInput> & { quoteId: string }, userId: string) {
  // billToText/shipToText/orderedByEmail vêm do cadastro do cliente vinculado
  // ao orçamento quando existirem — isso é dado real, não "chute" (ver
  // regra em neoKnowledge.ts). Sem cliente vinculado ou sem esses campos
  // preenchidos no cadastro, `orderFieldsSchema.parse` abaixo falha por
  // campo obrigatório ausente, e o Neo (instruído pelo system prompt) deve
  // perguntar antes de tentar de novo.
  const quote = await prisma.quote.findUnique({ where: { id: args.quoteId }, include: { client: true } })
  if (!quote) throw new HttpError(404, 'Orçamento não encontrado')

  const merged = {
    ...args,
    billToText: args.billToText ?? quote.client?.billToText ?? undefined,
    shipToText: args.shipToText ?? quote.client?.shipToText ?? undefined,
    orderedByEmail: args.orderedByEmail ?? quote.client?.email ?? undefined,
  }
  const data = orderFieldsSchema.parse(merged)
  const summary = `Pedido novo a partir do orçamento ${quote.quoteNumber}, ${data.packageCount ?? 1} caixa(s), pagamento ${data.prepaymentBy ?? 'transferência bancária (padrão)'}.`
  const pendingAction = createPendingAction('pedido_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoPedido(args: { pedidoId: string } & Omit<OrderFieldsInput, 'quoteId'>, userId: string) {
  const { pedidoId, ...rest } = args
  const data = orderFieldsSchema.omit({ quoteId: true }).partial().parse(rest)
  const summary = `Edição do pedido — campos alterados: ${Object.keys(data).join(', ') || '(nenhum)'}.`
  const pendingAction = createPendingAction('pedido_editar', summary, { pedidoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoCliente(args: { clienteId: string } & Record<string, unknown>, userId: string) {
  const { clienteId, ...rest } = args
  const summary = `Edição do cliente — campos alterados: ${Object.keys(rest).join(', ') || '(nenhum)'}.`
  const pendingAction = createPendingAction('cliente_editar', summary, { clienteId, data: rest }, userId)
  return { pendingAction, summaryForModel: summary }
}
