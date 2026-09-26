import { prisma } from './prisma.js'
import { toClientDTO } from './dto.js'
import { completedOrdersFor, createQuoteSchema, resolveQuoteData, type CreateQuoteInput } from '../routes/quotes.routes.js'
import { orderFieldsSchema, type OrderFieldsInput } from '../routes/orders.routes.js'
import { missingPostOrderDocs } from '../domain/orderDocuments.js'
import { clientBodySchema } from '../routes/clients.routes.js'
import { ensureColumns } from '../routes/tasks.routes.js'
import { libraryEntrySchema, searchLibraryEntries } from '../routes/library.routes.js'
import { createPendingAction } from './neoPendingActions.js'
import { HttpError } from '../middleware/errorHandler.js'
import { normalize, bestMatches } from './fuzzyMatch.js'
import { saidYesToDefault } from './neoConsent.js'

/**
 * O catálogo separa o que é um simulador inteiro do que é peça de reposição.
 * O enum do banco não diz isso a quem lê a resposta, então a ferramenta
 * entrega o rótulo que o site usa — o modelo não precisa adivinhar o que
 * COMPLETE_MODEL significa nem inventar tradução.
 */
const PRODUCT_KIND_LABEL: Record<string, string> = {
  COMPLETE_MODEL: 'modelo completo',
  COMPONENT: 'componente (peça)',
}

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
  description?: string | null
  descriptionPt?: string | null
  components?: string | null
  componentsPt?: string | null
}, detalhes = false) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    tipo: PRODUCT_KIND_LABEL[p.kind] ?? p.kind,
    sectors: p.sectors,
    priceBRL: p.priceBRL?.toString() ?? null,
    priceUSD: p.priceUSD?.toString() ?? null,
    priceUSDDistributor: p.priceUSDDistributor?.toString() ?? null,
    priceEUR: p.priceEUR?.toString() ?? null,
    // Descrição e componentes padrão (a que o orçamento usa quando ninguém
    // customiza) — só em busca focada, pra não inchar uma lista de 30 produtos.
    ...(detalhes && {
      descricaoPadrao: { en: p.description ?? null, pt: p.descriptionPt || p.description || null },
      componentesPadrao: { en: p.components ?? null, pt: p.componentsPt || p.components || null },
    }),
  }
}

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

// "Qual o mais caro?", "tem versão mais barata pra essa área?", "o que cabe em
// até 5 mil?" — perguntas de tabela de preço que, sem ordenação/filtro no
// banco, o modelo só conseguiria responder lendo o catálogo inteiro (e erraria,
// porque a lista vem cortada).
const PRICE_COLUMN = {
  BRL: 'priceBRL',
  USD: 'priceUSD',
  EUR: 'priceEUR',
  USD_DISTRIBUIDOR: 'priceUSDDistributor',
} as const

type PriceCurrency = keyof typeof PRICE_COLUMN

interface BuscarProdutosArgs {
  setores?: string[]
  tipo?: 'modelo_completo' | 'componente'
  texto?: string
  moeda?: PriceCurrency
  ordenar?: 'preco_desc' | 'preco_asc' | 'nome'
  precoMin?: number
  precoMax?: number
  limite?: number
}

export async function buscarProdutos(args: BuscarProdutosArgs) {
  const { texto, tipo, ordenar = 'nome', precoMin, precoMax } = args
  const moeda: PriceCurrency = args.moeda ?? 'BRL'
  const coluna = PRICE_COLUMN[moeda]
  const porPreco = ordenar !== 'nome' || precoMin !== undefined || precoMax !== undefined

  const { names: setores, notFound } = await resolveSectorNames(args.setores ?? [])
  if (args.setores?.length && setores.length === 0) {
    return { produtos: [], aviso: `Nenhum destes setores existe: ${notFound.join(', ')}. Use os nomes de listar_setores.` }
  }
  const limite = Math.min(Math.max(args.limite ?? PRODUCT_LIMIT, 1), PRODUCT_LIMIT)
  const kind =
    tipo === 'modelo_completo' ? ('COMPLETE_MODEL' as const) : tipo === 'componente' ? ('COMPONENT' as const) : undefined
  // Sem o texto: usado tanto no filtro principal quanto, se ele não achar
  // nada, pra montar o universo de candidatos da busca por semelhança.
  const semTexto = [
    setores.length > 0 ? { sectors: { hasSome: setores } } : {},
    // Filtrar aqui (e não depois, na lista) é o que faz "quantos modelos
    // completos existem" bater: `total` conta o mesmo recorte.
    kind ? { kind } : {},
    // Produto sem preço na moeda pedida não pode entrar num ranking de
    // preço: apareceria como "mais barato" por não ter valor nenhum.
    porPreco ? { [coluna]: { not: null } } : {},
    precoMin !== undefined ? { [coluna]: { gte: precoMin } } : {},
    precoMax !== undefined ? { [coluna]: { lte: precoMax } } : {},
  ]
  const where = {
    active: true,
    AND: [
      ...semTexto,
      texto
        ? {
            OR: [
              { name: { contains: texto, mode: 'insensitive' as const } },
              { description: { contains: texto, mode: 'insensitive' as const } },
              { descriptionPt: { contains: texto, mode: 'insensitive' as const } },
            ],
          }
        : {},
    ],
  }
  // `total` é a contagem real, sem o corte de `limite` — sem isto, "quantos
  // produtos vocês têm" era impossível de responder direito: a lista sempre
  // vinha cortada em 30, e não tinha como o modelo saber se aqueles 30 eram
  // o catálogo inteiro ou uma fração dele.
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: limite,
      orderBy: ordenar === 'nome' ? { name: 'asc' } : { [coluna]: ordenar === 'preco_desc' ? 'desc' : 'asc' },
    }),
    prisma.product.count({ where }),
  ])

  // Texto buscado, nada bateu: pode ser erro de digitação ("Thor" por
  // "Thoor") — sugere pelos mais parecidos dentro dos MESMOS outros filtros,
  // em vez de simplesmente devolver uma lista vazia.
  if (total === 0 && texto) {
    const candidatos = await prisma.product.findMany({ where: { active: true, AND: semTexto }, take: 300 })
    const sugeridos = bestMatches(texto, candidatos, (p) => p.name)
    if (sugeridos.length > 0) {
      return {
        total: 0,
        produtos: [],
        sugestoesPorSemelhanca: sugeridos.map((p) => productSummary(p)),
        aviso: 'Nenhum produto bateu exatamente com esse texto — pode ser erro de digitação. Pergunte à pessoa se é um desses antes de usar.',
      }
    }
  }

  return {
    total,
    ...(porPreco && { criterio: `preços em ${moeda}${ordenar === 'preco_desc' ? ', do mais caro' : ordenar === 'preco_asc' ? ', do mais barato' : ''}` }),
    produtos: products.map((p) => productSummary(p, products.length <= 5)),
    ...(total > limite && { aviso: `${total} produto(s) no total, mostrando os ${limite} primeiros — refine com texto, setor ou limite pra ver outros, mas 'total' já é a contagem real.` }),
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
  if (clients.length > 0) return { clientes: clients.map((c) => toClientDTO(c)) }

  // Nada bateu por substring: pode ser erro de digitação ("MediGlobal" por
  // "Mad Global") — sugere pelos cadastros mais parecidos, em nome OU
  // instituição, em vez de simplesmente dizer que o cliente não existe.
  const candidatos = await prisma.client.findMany({ take: 500, orderBy: { name: 'asc' } })
  const sugeridos = bestMatches(args.nome, candidatos, (c) => `${c.name} ${c.institution ?? ''}`.trim())
  if (sugeridos.length === 0) return { clientes: [], aviso: 'Nenhum cliente encontrado com esse nome.' }
  return {
    clientes: [],
    sugestoesPorSemelhanca: sugeridos.map((c) => toClientDTO(c)),
    aviso: 'Nenhum cliente com esse nome exato — pode ser erro de digitação. Pergunte à pessoa se é um desses antes de usar o clientId; nunca escolha sozinho.',
  }
}

/**
 * "O que falta fazer": pedidos pendentes sem AWB/NF (regra em
 * missingPostOrderDocs, compartilhada com o lembrete automático que o
 * sistema cria sozinho) e clientes em atendimento sem orçamento recente ou
 * nunca orçados — sinal de acompanhamento comercial esfriando.
 */
export async function verificarPendencias() {
  const pendingOrders = await prisma.order.findMany({
    where: { status: 'PENDING' },
    select: {
      orderNumber: true,
      awbNumber: true,
      nfNumber: true,
      quote: { select: { quoteNumber: true, clientName: true, exportScope: true } },
    },
    orderBy: { orderNumber: 'asc' },
  })
  const pedidosComPendencia = pendingOrders
    .map((o) => ({
      orderNumber: o.orderNumber,
      quoteNumber: o.quote.quoteNumber,
      clientName: o.quote.clientName,
      falta: missingPostOrderDocs({ status: 'PENDING', awbNumber: o.awbNumber, nfNumber: o.nfNumber }, o.quote.exportScope),
    }))
    .filter((o) => o.falta.length > 0)

  const inServiceClients = await prisma.client.findMany({
    where: { active: true, inService: true },
    select: { id: true, name: true },
  })
  let clientesEmAtendimento: { name: string; diasSemOrcamento: number | null; nuncaOrcado: boolean }[] = []
  if (inServiceClients.length > 0) {
    const lastQuoteRows = await prisma.quote.groupBy({
      by: ['clientId'],
      where: { clientId: { in: inServiceClients.map((c) => c.id) } },
      _max: { createdAt: true },
    })
    const lastQuoteMap = new Map(lastQuoteRows.map((r) => [r.clientId, r._max.createdAt]))
    clientesEmAtendimento = inServiceClients
      .map((c) => {
        const last = lastQuoteMap.get(c.id) ?? null
        return {
          name: c.name,
          diasSemOrcamento: last ? Math.floor((Date.now() - last.getTime()) / 86_400_000) : null,
          nuncaOrcado: last === null,
        }
      })
      .toSorted((a, b) => (b.diasSemOrcamento ?? Infinity) - (a.diasSemOrcamento ?? Infinity))
  }

  return { pedidosComPendencia, clientesEmAtendimento }
}

interface CriarTarefaArgs {
  titulo: string
  notas?: string
  clienteNome?: string
  tags?: string[]
  prazo?: string
  coluna?: string
  orcamentoId?: string
  pedidoId?: string
}

/**
 * Única escrita do NEO que não passa por prévia+confirmação (ver a exceção
 * na regra inegociável em neoKnowledge.ts): é uma tarefa pessoal no quadro
 * de quem está conversando, não um documento comercial — baixo risco,
 * reversível na hora pela própria pessoa (editar/apagar na tela).
 */
export async function criarTarefa(args: CriarTarefaArgs, userId: string) {
  if (!args.titulo?.trim()) throw new HttpError(400, 'Toda tarefa precisa de um título.')

  let dueDate: Date | null = null
  if (args.prazo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.prazo)) throw new HttpError(400, 'Prazo inválido — peça a data no formato AAAA-MM-DD.')
    dueDate = new Date(`${args.prazo}T12:00:00Z`)
  }

  if (args.orcamentoId) {
    const quote = await prisma.quote.findUnique({ where: { id: args.orcamentoId }, select: { id: true } })
    if (!quote) throw new HttpError(404, 'Orçamento não encontrado — use buscar_orcamentos pra achar o id certo.')
  }
  if (args.pedidoId) {
    const order = await prisma.order.findUnique({ where: { id: args.pedidoId }, select: { id: true } })
    if (!order) throw new HttpError(404, 'Pedido não encontrado — use buscar_pedidos pra achar o id certo.')
  }

  const columns = await ensureColumns(userId)
  let column = columns[0]
  if (args.coluna) {
    const match = columns.find((c) => normalize(c.name) === normalize(args.coluna!))
    if (!match) {
      throw new HttpError(
        400,
        `Não existe coluna "${args.coluna}" nesse quadro. Colunas disponíveis: ${columns.map((c) => c.name).join(', ')}.`,
      )
    }
    column = match
  }

  const position = await prisma.personalTask.count({ where: { userId, columnId: column.id } })
  const task = await prisma.personalTask.create({
    data: {
      userId,
      title: args.titulo.trim(),
      notes: args.notas?.trim() || null,
      clientName: args.clienteNome?.trim() || null,
      tags: args.tags ?? [],
      dueDate,
      columnId: column.id,
      position,
      quoteId: args.orcamentoId || null,
      orderId: args.pedidoId || null,
    },
  })
  return { id: task.id, titulo: task.title, coluna: column.name }
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
      // Idem: numa edição, descrição e componentes têm que ser repassados,
      // senão voltam pro padrão do produto e perdem o que foi customizado.
      description: i.description,
      components: i.components,
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
// USD, PT, FINAL). Pro NEO, cair num default desses é exatamente o "chute"
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
    (i) =>
      [
        `• ${i.quantity}× ${i.title} (SKU ${i.sku}) — ${money(currency, i.unitPrice)} cada = ${money(currency, i.lineTotal)}`,
        // O que vai impresso junto do item — aparece no cartão pra pessoa
        // conferir a descrição e os componentes antes de confirmar.
        i.description ? `   Descrição: ${i.description}` : null,
        i.components ? `   Componentes: ${i.components}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
  )
  const extras = [
    data.freight ? `Frete: ${money(currency, data.freight)}` : null,
    data.discount ? `Desconto: ${money(currency, data.discount)}` : null,
  ].filter(Boolean)
  return [`Cliente: ${data.clientName}`, scope, ...lines, ...extras, `Total: ${money(currency, resolved.total)}`].join('\n')
}

// Mesma ideia de `missingQuoteDecisions`: o modelo lite escorrega em "assumir o
// padrão" quando a regra só está no prompt. Então deixar descrição ou
// componentes de fora só passa se a pessoa autorizou o padrão — senão a
// recusa volta pro modelo como instrução de perguntar.
async function missingDescriptionDecisions(
  items: CreateQuoteInput['items'],
  padraoAutorizado: boolean | undefined,
  lastUserText: string,
) {
  if (padraoAutorizado && saidYesToDefault(lastUserText)) return
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, name: true, kind: true },
  })
  const byId = new Map(products.map((p) => [p.id, p]))
  const pendentes = items.flatMap((item) => {
    const product = byId.get(item.productId)
    if (!product) return []
    const faltando = [
      !item.description?.trim() && 'descrição',
      product.kind === 'COMPLETE_MODEL' && item.components === undefined && 'componentes',
    ].filter(Boolean)
    return faltando.length > 0 ? [`${product.name} (${faltando.join(' e ')})`] : []
  })
  if (pendentes.length > 0) {
    throw new HttpError(
      400,
      `Não proponha ainda — pergunte à pessoa: "Quer que eu use a descrição padrão e os componentes padrão do produto?" para ${pendentes.join('; ')}. Se ela disser sim, chame de novo com padraoDescricaoComponentesAutorizado=true; se disser não, pergunte como ela quer a descrição e os componentes e preencha description e components (components vazio = sem componentes).`,
    )
  }
}

export async function proporOrcamento(
  args: CreateQuoteInput & { padraoDescricaoComponentesAutorizado?: boolean },
  userId: string,
  lastUserText: string,
) {
  missingQuoteDecisions(args)
  await missingDescriptionDecisions(args.items, args.padraoDescricaoComponentesAutorizado, lastUserText)
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
  // NEO chama `updateQuoteRecord` direto — sem isto ele editaria os valores de
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
  sectors: 'Setores de interesse',
  kind: 'Tipo',
  notes: 'Observações',
  orderedByEmail: 'E-mail do pedido',
  packageCount: 'Caixas',
  prepaymentBy: 'Pagamento',
  incoterms: 'Incoterms',
  shippingMethod: 'Envio',
  netWeightKg: 'Peso líquido (kg)',
  grossWeightKg: 'Peso bruto (kg)',
  awbNumber: 'AWB',
  purchaseOrder: 'Pedido de compra',
  shipDate: 'Data de expedição',
  nfNumber: 'Número da NF',
  nfDate: 'Data da NF',
  paypalFee: 'Taxa do PayPal',
}

function describeChanges(fields: Record<string, unknown>) {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const value =
        typeof v === 'boolean' ? (v ? 'Sim' : 'Não')
        : v instanceof Date ? formatDate(v)
        : Array.isArray(v) ? v.join(', ')
        : k === 'prepaymentBy' ? PREPAYMENT_LABEL[String(v)]
        : v === '' ? '(em branco)'
        : String(v)
      return `• ${FIELD_LABEL[k] ?? k}: ${value}`
    })
}

const PREPAYMENT_LABEL: Record<string, string> = { PAYPAL: 'PayPal', WIRE_TRANSFER: 'Transferência bancária', PIX: 'Pix' }

function formatDate(value: Date | undefined) {
  return value ? value.toISOString().slice(0, 10).split('-').toReversed().join('/') : '(em branco)'
}

function describeItemWeights(items: QuoteItemRef[], weights: (number | null)[] | undefined) {
  if (!weights?.some((w) => w !== null)) return []
  const linhas = items
    .map((item, i) => (weights[i] === null ? null : `   ${item.title ?? item.productName}: ${weights[i]} kg/un`))
    .filter(Boolean) as string[]
  return ['Peso por unidade:', ...linhas]
}

function describeBoxes(boxes: { label: string; quantity: number }[][] | undefined, avulsos: string[]) {
  if (!boxes?.length) return []
  const linhas = boxes.map(
    (itens, i) => `   Caixa ${i + 1}: ${itens.map((e) => `${e.quantity}× ${e.label}`).join(', ') || '(vazia)'}`,
  )
  const aviso = avulsos.length > 0 ? [`⚠ Item que não está no orçamento (item avulso): ${[...new Set(avulsos)].join(', ')}`] : []
  return ['Divisão por caixa:', ...linhas, ...aviso]
}

/**
 * O banco guarda peso por item como array alinhado por índice do item do
 * orçamento, e caixa como array de arrays. Pedir isso ao modelo nessa forma é
 * convite a desalinhamento silencioso (peso do item errado no documento), então
 * as tools recebem por SKU/nome e a conversão acontece aqui.
 */
interface NeoOrderExtras {
  pesosPorItem?: { item: string; kgPorUnidade: number }[]
  caixas?: { caixa: number; itens: { item: string; quantidade: number }[] }[]
  pessoaAutorizouPadrao?: boolean
}

type QuoteItemRef = { sku: string; title: string | null; productName: string; quantity: number }

function matchQuoteItem(items: QuoteItemRef[], termo: string) {
  const alvo = normalize(termo)
  return items.findIndex(
    (i) => normalize(i.sku) === alvo || normalize(i.title ?? '') === alvo || normalize(i.productName) === alvo,
  )
}

function buildItemWeights(items: QuoteItemRef[], pesos: NeoOrderExtras['pesosPorItem']) {
  if (!pesos?.length) return undefined
  const weights: (number | null)[] = items.map(() => null)
  const naoEncontrados: string[] = []
  for (const { item, kgPorUnidade } of pesos) {
    const index = matchQuoteItem(items, item)
    if (index === -1) naoEncontrados.push(item)
    else weights[index] = kgPorUnidade
  }
  if (naoEncontrados.length > 0) {
    throw new HttpError(
      400,
      `Estes itens não existem no orçamento: ${naoEncontrados.join(', ')}. Use o SKU ou o nome exato que buscar_orcamentos devolveu.`,
    )
  }
  return weights
}

function buildBoxAssignments(
  items: QuoteItemRef[],
  caixas: NeoOrderExtras['caixas'],
  packageCount: number | undefined,
  // Numa edição, caixa não citada continua como está: sem isto, mexer só na
  // caixa 2 apagaria o conteúdo da caixa 1.
  existentes?: { label: string; quantity: number }[][] | null,
) {
  if (!caixas?.length) return { boxAssignments: undefined, avulsos: [] as string[] }
  const invalidas = caixas.filter((c) => !Number.isInteger(c.caixa) || c.caixa < 1)
  if (invalidas.length > 0) {
    throw new HttpError(400, 'Número de caixa inválido: as caixas são numeradas a partir de 1. Confirme com a pessoa qual item vai em qual caixa.')
  }
  const maiorCaixa = Math.max(...caixas.map((c) => c.caixa), existentes?.length ?? 0)
  if (packageCount !== undefined && maiorCaixa > packageCount) {
    throw new HttpError(400, `A divisão usa ${maiorCaixa} caixas, mas o pedido declara ${packageCount}. Confirme o número de caixas com a pessoa.`)
  }
  const boxAssignments: { label: string; quantity: number }[][] = Array.from({ length: maiorCaixa }, (_, i) =>
    caixas.some((c) => c.caixa === i + 1) ? [] : [...(existentes?.[i] ?? [])],
  )
  const avulsos: string[] = []
  for (const caixa of caixas) {
    for (const { item, quantidade } of caixa.itens) {
      const index = matchQuoteItem(items, item)
      // Item que não está no orçamento é item avulso (adicionado à mão na
      // caixa). É legítimo, mas vai destacado no cartão pra ninguém gravar um
      // item inventado sem perceber.
      if (index === -1) avulsos.push(item)
      boxAssignments[caixa.caixa - 1].push({ label: index === -1 ? item : (items[index].title ?? items[index].productName), quantity: quantidade })
    }
  }
  return { boxAssignments, avulsos }
}

export async function proporPedido(
  args: Partial<OrderFieldsInput> & { quoteId: string } & NeoOrderExtras,
  userId: string,
) {
  // billToText/shipToText/orderedByEmail vêm do cadastro do cliente vinculado
  // ao orçamento quando existirem — isso é dado real, não "chute" (ver
  // regra em neoKnowledge.ts). Sem cliente vinculado ou sem esses campos
  // preenchidos no cadastro, `orderFieldsSchema.parse` abaixo falha por
  // campo obrigatório ausente, e o NEO (instruído pelo system prompt) deve
  // perguntar antes de tentar de novo.
  const quote = await prisma.quote.findUnique({
    where: { id: args.quoteId },
    include: { client: true, items: { include: { product: { select: { name: true } } } } },
  })
  if (!quote) throw new HttpError(404, 'Orçamento não encontrado')

  const { pesosPorItem, caixas, pessoaAutorizouPadrao, ...orderArgs } = args
  const quoteItems: QuoteItemRef[] = quote.items.map((i) => ({
    sku: i.sku,
    title: i.title,
    productName: i.product.name,
    quantity: i.quantity,
  }))
  const itemWeightsKg = buildItemWeights(quoteItems, pesosPorItem)
  const { boxAssignments, avulsos } = buildBoxAssignments(quoteItems, caixas, orderArgs.packageCount)

  const merged = {
    ...orderArgs,
    ...(itemWeightsKg && { itemWeightsKg }),
    ...(boxAssignments && { boxAssignments }),
    billToText: orderArgs.billToText ?? quote.client?.billToText ?? undefined,
    shipToText: orderArgs.shipToText ?? quote.client?.shipToText ?? undefined,
    orderedByEmail: orderArgs.orderedByEmail ?? quote.client?.email ?? undefined,
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
  const defaultable = pessoaAutorizouPadrao
    ? []
    : [
        orderArgs.packageCount === undefined && 'número de caixas',
        !orderArgs.prepaymentBy && 'forma de pagamento (PayPal, transferência ou Pix)',
        orderArgs.netWeightKg === undefined && 'peso líquido (kg)',
        orderArgs.grossWeightKg === undefined && 'peso bruto (kg)',
        isNational ? !orderArgs.shippingMethod && 'forma de envio' : !orderArgs.incoterms && 'Incoterms',
        !orderArgs.awbNumber && 'AWB',
        !orderArgs.purchaseOrder && 'pedido de compra',
        !orderArgs.shipDate && 'data de expedição',
        !pesosPorItem?.length && 'peso por unidade de cada item (Kg/Un)',
        !orderArgs.nfNumber && 'número da NF',
        !orderArgs.nfDate && 'data da NF',
        !caixas?.length && 'quais itens vão em cada caixa',
      ]
  const missing = [...neverDefault, ...defaultable].filter(Boolean)
  if (missing.length > 0) {
    throw new HttpError(
      400,
      `Não proponha ainda — pergunte à pessoa, numa mensagem só e com estes nomes em português: ${missing.join('; ')}. ` +
        'pessoaAutorizouPadrao=true só se ela disser explicitamente que pode deixar em branco/usar o padrão (não vale pros endereços e e-mail).',
    )
  }
  // A taxa do PayPal entra no total do invoice, então é perguntada sozinha,
  // depois de a pessoa dizer que o pagamento é PayPal — e nenhuma autorização
  // genérica de "usa o padrão" pula esta.
  if (orderArgs.prepaymentBy === 'PAYPAL' && orderArgs.paypalFee === undefined) {
    throw new HttpError(
      400,
      'Falta a taxa do PayPal. Mande uma mensagem só sobre isso, perguntando qual é a taxa do PayPal desse pedido (ela entra no total do invoice). Se não houver taxa, use paypalFee=0.',
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
    `AWB: ${data.awbNumber ?? '(em branco)'}`,
    `Pedido de compra: ${data.purchaseOrder ?? '(em branco)'}`,
    `Data de expedição: ${formatDate(data.shipDate)}`,
    `NF: ${data.nfNumber ?? '(em branco)'} — ${formatDate(data.nfDate)}`,
    ...(data.prepaymentBy === 'PAYPAL' ? [`Taxa do PayPal: ${money(quote.currency, data.paypalFee ?? 0)}`] : []),
    ...describeItemWeights(quoteItems, data.itemWeightsKg),
    ...describeBoxes(data.boxAssignments, avulsos),
  ].join('\n')
  const pendingAction = createPendingAction('pedido_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporEdicaoPedido(
  args: { pedidoId: string } & Omit<OrderFieldsInput, 'quoteId'> & NeoOrderExtras,
  userId: string,
) {
  const { pedidoId, pesosPorItem, caixas, pessoaAutorizouPadrao: _ignorado, ...rest } = args
  const order = await prisma.order.findUnique({
    where: { id: pedidoId },
    select: {
      orderNumber: true,
      packageCount: true,
      boxAssignments: true,
      quote: { select: { items: { include: { product: { select: { name: true } } } } } },
    },
  })
  if (!order) throw new HttpError(404, 'Pedido não encontrado — use buscar_pedidos pra achar o id certo.')

  const quoteItems: QuoteItemRef[] = order.quote.items.map((i) => ({
    sku: i.sku,
    title: i.title,
    productName: i.product.name,
    quantity: i.quantity,
  }))
  const itemWeightsKg = buildItemWeights(quoteItems, pesosPorItem)
  const { boxAssignments, avulsos } = buildBoxAssignments(
    quoteItems,
    caixas,
    rest.packageCount ?? order.packageCount,
    order.boxAssignments as { label: string; quantity: number }[][] | null,
  )

  const data = orderFieldsSchema
    .omit({ quoteId: true })
    .partial()
    .parse({ ...rest, ...(itemWeightsKg && { itemWeightsKg }), ...(boxAssignments && { boxAssignments }) })
  const changes = [
    ...describeChanges({ ...data, itemWeightsKg: undefined, boxAssignments: undefined }),
    ...describeItemWeights(quoteItems, data.itemWeightsKg),
    ...describeBoxes(data.boxAssignments, avulsos),
  ]
  const summary = [`Edição do pedido ${order.orderNumber}`, ...(changes.length ? changes : ['(nenhum campo alterado)'])].join('\n')
  const pendingAction = createPendingAction('pedido_editar', summary, { pedidoId, data }, userId)
  return { pendingAction, summaryForModel: summary }
}

export async function proporCliente(args: Record<string, unknown>, userId: string) {
  const parsed = clientBodySchema.parse(args)
  // Setor de interesse precisa bater com o nome canônico do catálogo — senão
  // "Laparoscopia" (o que o modelo digitou) nunca casa com "Laparoscopy" (o
  // que fica em Product.sectors), e o cruzamento cliente↔produto quebra
  // silenciosamente.
  let data = parsed
  if (parsed.sectors?.length) {
    const { names, notFound } = await resolveSectorNames(parsed.sectors)
    if (notFound.length > 0) {
      throw new HttpError(400, `Estes setores não existem no catálogo: ${notFound.join(', ')}. Use os nomes de listar_setores.`)
    }
    data = { ...parsed, sectors: names }
  }
  const changes = describeChanges(data)
  const summary = ['Novo cliente', ...(changes.length ? changes : [`• Nome: ${data.name}`])].join('\n')
  const pendingAction = createPendingAction('cliente_criar', summary, data, userId)
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

const LIBRARY_MATCH_LABEL = {
  strong: 'quase a mesma pergunta',
  related: 'mesmo assunto',
} as const

export async function buscarBiblioteca(args: { pergunta: string; produtoId?: string; clienteId?: string }) {
  const { entries } = await searchLibraryEntries({
    query: args.pergunta,
    productId: args.produtoId,
    clientId: args.clienteId,
    limit: 5,
  })
  if (entries.length === 0) {
    return {
      encontrados: [],
      aviso: 'Nada parecido na Biblioteca. Diga isso à pessoa, sem inventar a resposta — ela verifica com a empresa e depois cadastra.',
    }
  }
  return {
    encontrados: entries.map((e) => ({
      pergunta: e.question,
      resposta: e.answer,
      topicos: e.topics.map((t) => `${t.type === 'product' ? 'Produto' : 'Cliente'}: ${t.name}${t.detail ? ` (${t.detail})` : ''}`),
      semelhanca: LIBRARY_MATCH_LABEL[e.match ?? 'related'],
      atualizadoEm: e.updatedAt.slice(0, 10),
    })),
  }
}

export async function proporRegistroBiblioteca(
  args: { pergunta: string; resposta: string; produtoIds?: string[]; clienteIds?: string[] },
  userId: string,
) {
  const data = libraryEntrySchema.parse({
    question: args.pergunta,
    answer: args.resposta,
    productIds: args.produtoIds ?? [],
    clientIds: args.clienteIds ?? [],
  })
  const [products, clients] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: data.productIds } }, select: { name: true } }),
    prisma.client.findMany({ where: { id: { in: data.clientIds } }, select: { name: true } }),
  ])
  if (products.length !== new Set(data.productIds).size || clients.length !== new Set(data.clientIds).size) {
    throw new HttpError(400, 'Algum tópico não existe — pegue o productId com buscar_produtos e o clienteId com buscar_cliente.')
  }
  const summary = [
    'Nova pergunta na Biblioteca',
    `• Pergunta: ${data.question}`,
    `• Resposta: ${data.answer}`,
    `• Tópicos: ${[...products.map((p) => p.name), ...clients.map((c) => c.name)].join(', ')}`,
  ].join('\n')
  const pendingAction = createPendingAction('biblioteca_criar', summary, data, userId)
  return { pendingAction, summaryForModel: summary }
}
