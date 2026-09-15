import { prisma } from './prisma.js'
import { toClientDTO } from './dto.js'
import { completedOrdersFor, createQuoteSchema, resolveQuoteData, type CreateQuoteInput } from '../routes/quotes.routes.js'
import { orderFieldsSchema, type OrderFieldsInput } from '../routes/orders.routes.js'
import { clientBodySchema } from '../routes/clients.routes.js'
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

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// `products.sectors`/`clients.sectors` guardam o nome canônico (inglês), mas o
// modelo lê `listar_setores` e às vezes devolve o `namePt` — "Injeção Vascular"
// em vez de "Vascular Injection" — e o filtro exato perdia esses produtos.
async function resolveSectorNames(inputs: string[]) {
  const sectors = await prisma.sector.findMany({ select: { name: true, namePt: true } })
  const byKey = new Map<string, string>()
  for (const s of sectors) {
    byKey.set(normalize(s.name), s.name)
    if (s.namePt) byKey.set(normalize(s.namePt), s.name)
  }
  const found = new Set<string>()
  const notFound: string[] = []
  for (const input of inputs) {
    const name = byKey.get(normalize(input))
    if (name) found.add(name)
    else notFound.push(input)
  }
  return { names: [...found], notFound }
}

const PRODUCT_LIMIT = 30

export async function buscarProdutos(args: { setores?: string[]; texto?: string }) {
  const { texto } = args
  const { names: setores, notFound } = await resolveSectorNames(args.setores ?? [])
  if (args.setores?.length && setores.length === 0) {
    return { produtos: [], aviso: `Nenhum destes setores existe: ${notFound.join(', ')}. Use os nomes de listar_setores.` }
  }
  const products = await prisma.product.findMany({
    where: {
      active: true,
      AND: [
        setores.length > 0 ? { sectors: { hasSome: setores } } : {},
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
    take: PRODUCT_LIMIT + 1,
    orderBy: { name: 'asc' },
  })
  return {
    produtos: products.slice(0, PRODUCT_LIMIT).map(productSummary),
    ...(products.length > PRODUCT_LIMIT && { aviso: `Lista cortada em ${PRODUCT_LIMIT} — refine com texto ou menos setores.` }),
    ...(notFound.length > 0 && { setoresNaoEncontrados: notFound }),
  }
}

export async function listarClientes(args: { filtro?: string; setor?: string; emAtendimento?: boolean }) {
  const { filtro, emAtendimento } = args
  const setor = args.setor ? ((await resolveSectorNames([args.setor])).names[0] ?? args.setor) : undefined
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
    // Vendedor chama cliente tanto pela pessoa quanto pela instituição.
    where: {
      OR: [
        { name: { contains: args.nome, mode: 'insensitive' } },
        { institution: { contains: args.nome, mode: 'insensitive' } },
      ],
    },
    take: 5,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function listarSetores() {
  return prisma.sector.findMany({ select: { name: true, namePt: true }, orderBy: { name: 'asc' } })
}

// Sem estas duas, editar orçamento e criar/editar pedido eram inalcançáveis:
// as ferramentas de escrita pedem o id interno, e a pessoa só conhece o número
// ("orçamento 260915-01", "pedido 412") ou o cliente.
export async function buscarOrcamentos(args: { numero?: string; cliente?: string }) {
  const quotes = await prisma.quote.findMany({
    where: {
      AND: [
        args.numero ? { quoteNumber: { contains: args.numero.trim() } } : {},
        args.cliente ? { clientName: { contains: args.cliente, mode: 'insensitive' } } : {},
      ],
    },
    include: {
      items: true,
      orders: { select: { orderNumber: true } },
      client: { select: { email: true, billToText: true, shipToText: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  return quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    clientName: q.clientName,
    clientId: q.clientId,
    exportScope: q.exportScope,
    currency: q.currency,
    language: q.language,
    priceTier: q.priceTier,
    freight: q.freight?.toString() ?? null,
    discount: q.discount.toString(),
    total: q.total.toString(),
    notes: q.notes,
    createdAt: q.createdAt.toISOString().slice(0, 10),
    pedidos: q.orders.map((o) => o.orderNumber),
    // O que `propor_pedido` vai puxar do cadastro — null aqui é o que o
    // modelo precisa perguntar junto com caixas/pesos/pagamento.
    cadastroDoCliente: {
      email: q.client?.email || null,
      enderecoCobranca: q.client?.billToText || null,
      enderecoEntrega: q.client?.shipToText || null,
    },
    items: q.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      title: i.title,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toString(),
      // Diferente do listPrice = preço especial negociado; numa edição ele
      // precisa ser repassado, senão volta pro preço de catálogo.
      listPrice: i.listPrice?.toString() ?? null,
    })),
  }))
}

export async function buscarPedidos(args: { numero?: number; cliente?: string }) {
  const orders = await prisma.order.findMany({
    where: {
      AND: [
        args.numero !== undefined ? { orderNumber: args.numero } : {},
        args.cliente ? { quote: { clientName: { contains: args.cliente, mode: 'insensitive' } } } : {},
      ],
    },
    include: { quote: { select: { quoteNumber: true, clientName: true, exportScope: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    quoteId: o.quoteId,
    quoteNumber: o.quote.quoteNumber,
    clientName: o.quote.clientName,
    exportScope: o.quote.exportScope,
    orderedByEmail: o.orderedByEmail,
    billToText: o.billToText,
    shipToText: o.shipToText,
    packageCount: o.packageCount,
    prepaymentBy: o.prepaymentBy,
    incoterms: o.incoterms,
    shippingMethod: o.shippingMethod,
    netWeightKg: o.netWeightKg?.toString() ?? null,
    grossWeightKg: o.grossWeightKg?.toString() ?? null,
  }))
}

function money(currency: string, value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

// O schema de orçamento tem defaults pensados pro formulário (INTERNATIONAL,
// USD, PT, FINAL). Pro Neo, cair num default desses é exatamente o "chute"
// que a regra proíbe — e o modelo lite escorrega nisso com mais facilidade que
// o flash. Então as decisões que mudam preço/documento são exigidas aqui, e a
// recusa volta pro modelo como instrução de perguntar.
function missingQuoteDecisions(args: Partial<CreateQuoteInput>) {
  const missing: string[] = []
  if (!args.exportScope) missing.push('exportScope (orçamento NATIONAL ou INTERNATIONAL)')
  if (args.exportScope === 'INTERNATIONAL') {
    if (!args.currency || args.currency === 'BRL') missing.push('currency (USD ou EUR)')
    if (!args.language) missing.push('language (idioma do documento: EN, ES ou PT)')
    if (args.currency === 'USD' && !args.priceTier) missing.push('priceTier (preço FINAL ou DISTRIBUTOR)')
  }
  if (missing.length > 0) {
    throw new HttpError(400, `Não proponha ainda — pergunte à pessoa: ${missing.join('; ')}.`)
  }
}

async function describeQuote(data: CreateQuoteInput, userId: string) {
  const resolved = await resolveQuoteData(data, userId)
  const { currency } = resolved
  const scope =
    data.exportScope === 'NATIONAL'
      ? 'Nacional (BRL, português)'
      : `Internacional (${currency}${resolved.priceTier === 'DISTRIBUTOR' ? ', preço distribuidor' : ''}, idioma ${data.language})`
  const lines = resolved.lineItems.map(
    (i) => `• ${i.quantity}× ${i.title} (SKU ${i.sku}) — ${money(currency, i.unitPrice)} cada = ${money(currency, i.lineTotal)}`,
  )
  const extras = [
    data.freight ? `Frete: ${money(currency, data.freight)}` : null,
    data.discount ? `Desconto: ${money(currency, data.discount)}` : null,
  ].filter(Boolean)
  return [`Cliente: ${data.clientName}`, scope, ...lines, ...extras, `Total: ${money(currency, resolved.total)}`].join('\n')
}

export async function proporOrcamento(args: CreateQuoteInput, userId: string) {
  missingQuoteDecisions(args)
  const data = createQuoteSchema.parse(args)
  const summary = await describeQuote(data, userId)
  const pendingAction = createPendingAction('orcamento_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoOrcamento(args: { orcamentoId: string } & CreateQuoteInput, userId: string) {
  const { orcamentoId, ...rest } = args
  const existing = await prisma.quote.findUnique({ where: { id: orcamentoId }, select: { quoteNumber: true } })
  if (!existing) throw new HttpError(404, 'Orçamento não encontrado — use buscar_orcamentos pra achar o id certo.')
  missingQuoteDecisions(rest)

  // O aviso de "pedido concluído vinculado" mora na rota PATCH /quotes/:id, e o
  // Neo chama `updateQuoteRecord` direto — sem isto ele editaria os valores de
  // um pedido já concluído sem ninguém ser avisado.
  const completed = await completedOrdersFor(orcamentoId)
  const numbers = completed.map((o) => o.orderNumber).join(', ')
  if (completed.length > 0 && !rest.confirmCompletedOrders) {
    throw new HttpError(
      409,
      `Este orçamento já tem pedido concluído vinculado (${numbers}) e editar muda os valores desse pedido. Avise a pessoa e só repita com confirmCompletedOrders=true se ela disser que pode.`,
    )
  }

  const data = createQuoteSchema.parse({ ...rest, confirmCompletedOrders: true })
  const warning = completed.length > 0 ? `\n⚠ Muda também o pedido concluído ${numbers}.` : ''
  const summary = `Edição do orçamento ${existing.quoteNumber}\n${await describeQuote(data, userId)}${warning}`
  const pendingAction = createPendingAction('orcamento_editar', summary, { orcamentoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

// Cartão de confirmação é lido pelo vendedor, não por dev: nada de `inService: true`.
const FIELD_LABEL: Record<string, string> = {
  name: 'Nome',
  institution: 'Instituição',
  email: 'E-mail',
  phone: 'Telefone',
  country: 'País',
  billToText: 'Endereço de cobrança',
  shipToText: 'Endereço de entrega',
  inService: 'Em atendimento',
  notes: 'Observações',
  orderedByEmail: 'E-mail do pedido',
  packageCount: 'Caixas',
  prepaymentBy: 'Pagamento',
  incoterms: 'Incoterms',
  shippingMethod: 'Envio',
  netWeightKg: 'Peso líquido (kg)',
  grossWeightKg: 'Peso bruto (kg)',
}

function describeChanges(fields: Record<string, unknown>) {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const value = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : k === 'prepaymentBy' ? PREPAYMENT_LABEL[String(v)] : v === '' ? '(em branco)' : String(v)
      return `• ${FIELD_LABEL[k] ?? k}: ${value}`
    })
}

const PREPAYMENT_LABEL: Record<string, string> = { PAYPAL: 'PayPal', WIRE_TRANSFER: 'Transferência bancária', PIX: 'Pix' }

export async function proporPedido(
  args: Partial<OrderFieldsInput> & { quoteId: string; pessoaAutorizouPadrao?: boolean },
  userId: string,
) {
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
  // Mesmo motivo de `missingQuoteDecisions`: campo operacional de pedido só
  // fica no default do sistema se a pessoa disse explicitamente que pode.
  // Tudo que falta vai numa lista só, pra o modelo perguntar de uma vez em vez
  // de ir descobrindo campo a campo em várias idas e voltas.
  const isNational = quote.exportScope === 'NATIONAL'
  const neverDefault = [
    !merged.orderedByEmail && 'e-mail de quem fez o pedido',
    !merged.billToText && 'endereço de cobrança (o cliente não tem no cadastro)',
    !merged.shipToText && 'endereço de entrega (o cliente não tem no cadastro)',
  ]
  const defaultable = args.pessoaAutorizouPadrao
    ? []
    : [
        args.packageCount === undefined && 'número de caixas',
        !args.prepaymentBy && 'forma de pagamento (PayPal, transferência ou Pix)',
        args.netWeightKg === undefined && 'peso líquido (kg)',
        args.grossWeightKg === undefined && 'peso bruto (kg)',
        isNational ? !args.shippingMethod && 'forma de envio' : !args.incoterms && 'Incoterms',
      ]
  const missing = [...neverDefault, ...defaultable].filter(Boolean)
  if (missing.length > 0) {
    throw new HttpError(
      400,
      `Não proponha ainda — pergunte à pessoa, numa mensagem só e com estes nomes em português: ${missing.join('; ')}. ` +
        'pessoaAutorizouPadrao=true só se ela disser explicitamente que pode deixar em branco/usar o padrão (não vale pros endereços e e-mail).',
    )
  }
  const data = orderFieldsSchema.parse(merged)
  // Compara pelo valor, não por "o modelo mandou ou não": ele costuma repassar
  // o dado que leu do cadastro, e aí a origem sumia do cartão.
  const clientValues = { orderedByEmail: quote.client?.email, billToText: quote.client?.billToText, shipToText: quote.client?.shipToText }
  const fromClient = (field: keyof typeof clientValues) =>
    clientValues[field] && data[field] === clientValues[field] ? ' (do cadastro do cliente)' : ''
  const summary = [
    `Pedido a partir do orçamento ${quote.quoteNumber} — ${quote.clientName}`,
    `E-mail do pedido: ${data.orderedByEmail}${fromClient('orderedByEmail')}`,
    `Cobrança: ${data.billToText}${fromClient('billToText')}`,
    `Entrega: ${data.shipToText}${fromClient('shipToText')}`,
    `Caixas: ${data.packageCount ?? '1 (padrão)'}`,
    `Pagamento: ${data.prepaymentBy ? PREPAYMENT_LABEL[data.prepaymentBy] : 'Transferência bancária (padrão)'}`,
    isNational ? `Envio: ${data.shippingMethod ?? '(em branco)'}` : `Incoterms: ${data.incoterms ?? '(em branco)'}`,
    `Peso líquido: ${data.netWeightKg !== undefined ? `${data.netWeightKg} kg` : '(em branco)'}`,
    `Peso bruto: ${data.grossWeightKg !== undefined ? `${data.grossWeightKg} kg` : '(em branco)'}`,
  ].join('\n')
  const pendingAction = createPendingAction('pedido_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoPedido(args: { pedidoId: string } & Omit<OrderFieldsInput, 'quoteId'>, userId: string) {
  const { pedidoId, ...rest } = args
  const order = await prisma.order.findUnique({ where: { id: pedidoId }, select: { orderNumber: true } })
  if (!order) throw new HttpError(404, 'Pedido não encontrado — use buscar_pedidos pra achar o id certo.')
  const data = orderFieldsSchema.omit({ quoteId: true }).partial().parse(rest)
  const changes = describeChanges(data)
  const summary = [`Edição do pedido ${order.orderNumber}`, ...(changes.length ? changes : ['(nenhum campo alterado)'])].join('\n')
  const pendingAction = createPendingAction('pedido_editar', summary, { pedidoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoCliente(args: { clienteId: string } & Record<string, unknown>, userId: string) {
  const { clienteId, ...raw } = args
  const client = await prisma.client.findUnique({ where: { id: clienteId }, select: { name: true } })
  if (!client) throw new HttpError(404, 'Cliente não encontrado — use buscar_cliente pra achar o id certo.')
  // Valida já na prévia: senão um e-mail inválido só estourava depois do
  // clique em Confirmar, quando o modelo já não pode mais perguntar.
  const rest = clientBodySchema.partial().parse(raw)
  const changes = describeChanges(rest)
  const summary = [`Edição do cliente ${client.name}`, ...(changes.length ? changes : ['(nenhum campo alterado)'])].join('\n')
  const pendingAction = createPendingAction('cliente_editar', summary, { clienteId, data: rest }, userId)
  return { pendingAction, summaryForModel: summary }
}
