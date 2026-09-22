import { Router } from 'express'
import multer from 'multer'
import {
  ApiError,
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type Schema,
} from '@google/genai'
import { ZodError } from 'zod'
import { env, IS_PRODUCTION } from '../lib/env.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { buildNeoSystemInstruction } from '../lib/neoKnowledge.js'
import { toPublicPendingAction, getPendingAction, discardPendingAction, redactInternalIds } from '../lib/neoPendingActions.js'
import {
  buscarProdutos,
  listarClientes,
  buscarCliente,
  listarSetores,
  buscarOrcamentos,
  buscarPedidos,
  verificarPendencias,
  criarTarefa,
  proporOrcamento,
  proporEdicaoOrcamento,
  proporPedido,
  proporEdicaoPedido,
  proporCliente,
  proporEdicaoCliente,
} from '../lib/neoTools.js'
import { toQuoteDTO, toClientDTO } from '../lib/dto.js'
import { createQuoteRecord, updateQuoteRecord } from './quotes.routes.js'
import { createOrderRecord, updateOrderRecord, toOrderDTOFresh } from './orders.routes.js'
import { createClientRecord, updateClientRecord } from './clients.routes.js'

export const neoRouter = Router()
neoRouter.use(requireAuth)

// O lite responde em 2-5s, mas às vezes passa de 25s; o teto evita que uma
// chamada travada deixe a pessoa olhando os três pontinhos pra sempre.
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 45_000 } })

// Em memória, não em disco: é áudio de ditado, não um documento do sistema —
// vira texto e é descartado, nunca precisa sobreviver a um restart.
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const AUDIO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}
const MAX_TOOL_ITERATIONS = 6
// Picos de 429 (limite por minuto) e 5xx do Gemini costumam passar em segundos;
// sem retry, cada soluço desses virava erro na cara do usuário.
const RETRY_DELAYS_MS = [1500, 4000]

function isTransient(err: unknown) {
  return err instanceof ApiError && (err.status === 429 || err.status >= 500)
}

// O ApiError do Gemini traz `status` 4xx (ex.: 429 de cota), e o errorHandler
// repassaria a mensagem crua do Google — com detalhes de cota/projeto — como se
// fosse erro do request. Aqui vira uma mensagem amigável e o detalhe fica no log.
async function generateNeoContent(params: GenerateContentParameters) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent(params)
    } catch (err) {
      if (isTransient(err) && attempt < RETRY_DELAYS_MS.length) {
        console.warn(`[neo] Gemini ${(err as ApiError).status}, nova tentativa em ${RETRY_DELAYS_MS[attempt]}ms`)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
        continue
      }
      console.error('[neo] falha ao chamar o Gemini:', err)
      if (err instanceof ApiError && err.status === 429) {
        throw new HttpError(503, 'O NEO atingiu o limite de uso por agora. Tenta de novo daqui a pouco.')
      }
      throw new HttpError(502, 'O NEO não conseguiu responder agora. Tenta de novo em instantes.')
    }
  }
}

// Erro de validação numa ferramenta (faltou moeda, cliente sem endereço,
// orçamento inexistente) é informação pro modelo, não falha do request: ele
// precisa ver o que faltou pra perguntar à pessoa. Só erro inesperado sobe.
function toolErrorForModel(err: unknown) {
  if (err instanceof ZodError) {
    return {
      erro: 'Dados inválidos ou faltando — pergunte à pessoa antes de tentar de novo.',
      problemas: err.issues.map((i) => `${i.path.join('.') || '(geral)'}: ${i.message}`),
    }
  }
  if (err instanceof HttpError && err.status < 500) return { erro: err.message }
  return null
}

const readTools: FunctionDeclaration[] = [
  {
    name: 'buscar_produtos',
    description:
      'Busca produtos ativos do catálogo por setor(es), tipo e/ou texto livre, e também responde pergunta de preço: ordene por preço e use limite pra achar o mais caro/mais barato, ou precoMax/precoMin pra "o que cabe em até X". Devolve nome, SKU, tipo ("modelo completo" ou "componente (peça)"), setores e todos os preços. Pra "quais são os modelos completos" ou "quantos componentes existem", use o parâmetro tipo — sem ele a lista e o total misturam os dois. O campo "total" da resposta é a contagem REAL de produtos que casam com o filtro (não só os que vieram na lista, que pode vir cortada) — pra "quantos produtos vocês têm", chame sem nenhum filtro e leia "total".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        setores: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Nomes de setor, pode incluir vários (inclusive correlatos)' },
        tipo: {
          type: Type.STRING,
          enum: ['modelo_completo', 'componente'],
          description:
            'modelo_completo = o simulador inteiro, que é o que se vende como produto principal; componente = peça isolada (reposição/parte de um modelo). Sem este filtro vêm os dois misturados.',
        },
        texto: { type: Type.STRING, description: 'Texto livre pra buscar no nome/descrição do produto' },
        moeda: { type: Type.STRING, enum: ['BRL', 'USD', 'EUR', 'USD_DISTRIBUIDOR'], description: 'Moeda usada pra ordenar/filtrar preço (padrão BRL)' },
        ordenar: { type: Type.STRING, enum: ['nome', 'preco_desc', 'preco_asc'], description: 'preco_desc = mais caro primeiro; preco_asc = mais barato primeiro' },
        precoMin: { type: Type.NUMBER },
        precoMax: { type: Type.NUMBER, description: 'Ex.: "algo até 5 mil" → precoMax 5000' },
        limite: { type: Type.NUMBER, description: 'Quantos produtos devolver (máx. 30). Pro "mais caro", use 1' },
      },
    },
  },
  {
    name: 'listar_clientes',
    description: 'Lista clientes ativos, com filtros opcionais por texto, setor de interesse ou status "em atendimento".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filtro: { type: Type.STRING, description: 'Texto livre pra buscar no nome/instituição do cliente' },
        setor: { type: Type.STRING, description: 'Setor de interesse do cliente' },
        emAtendimento: { type: Type.BOOLEAN, description: 'true para só clientes marcados como em atendimento' },
      },
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca um cliente pelo nome da pessoa ou da instituição. Use antes de propor orçamento pra pegar o clientId real.',
    parameters: { type: Type.OBJECT, properties: { nome: { type: Type.STRING } }, required: ['nome'] },
  },
  {
    name: 'listar_setores',
    description: 'Lista todos os setores/áreas médicas do catálogo.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'buscar_orcamentos',
    description:
      'Busca orçamentos (os 10 mais recentes que casarem) por número e/ou nome do cliente. Devolve id, itens, moeda, total e números dos pedidos já criados. Use pra achar o id antes de editar orçamento ou criar pedido.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        numero: { type: Type.STRING, description: 'Número do orçamento, ex. 260915-01 (aceita parte)' },
        cliente: { type: Type.STRING, description: 'Nome do cliente' },
      },
    },
  },
  {
    name: 'buscar_pedidos',
    description: 'Busca pedidos (os 10 mais recentes que casarem) por número e/ou nome do cliente. Use pra achar o id antes de editar pedido.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        numero: { type: Type.NUMBER, description: 'Número do pedido' },
        cliente: { type: Type.STRING, description: 'Nome do cliente' },
      },
    },
  },
  {
    name: 'verificar_pendencias',
    description:
      'Lista o que está parado: pedidos pendentes sem AWB e/ou Nota Fiscal (conforme o pedido é nacional ou internacional) e clientes marcados em atendimento sem orçamento recente ou nunca orçados. Use pra perguntas como "o que falta fazer", "tem pendência", "quem eu preciso retornar".',
    parameters: { type: Type.OBJECT, properties: {} },
  },
]

const itemSchema = {
  type: Type.OBJECT,
  properties: {
    productId: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
  },
  required: ['productId', 'quantity'],
}

// Na edição o orçamento é reescrito inteiro: sem repassar o preço/nome que já
// estavam no item, um preço especial negociado com o cliente voltaria
// silenciosamente pro preço de catálogo.
const editItemSchema = {
  type: Type.OBJECT,
  properties: {
    productId: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    unitPrice: { type: Type.NUMBER, description: 'Repita o unitPrice atual do item (de buscar_orcamentos) quando ele difere do preço de catálogo' },
    title: { type: Type.STRING, description: 'Repita o title atual do item, se houver' },
  },
  required: ['productId', 'quantity'],
}

const quoteFieldsProps = {
  clientName: { type: Type.STRING },
  clientId: { type: Type.STRING, description: 'Id do cliente cadastrado (de buscar_cliente), se houver' },
  items: { type: Type.ARRAY, items: itemSchema },
  exportScope: { type: Type.STRING, enum: ['NATIONAL', 'INTERNATIONAL'], description: 'NATIONAL = Brasil, sempre BRL e português' },
  currency: { type: Type.STRING, enum: ['BRL', 'USD', 'EUR'], description: 'Obrigatório se INTERNATIONAL (USD ou EUR)' },
  language: { type: Type.STRING, enum: ['PT', 'EN', 'ES'], description: 'Idioma do documento. Obrigatório se INTERNATIONAL' },
  priceTier: { type: Type.STRING, enum: ['FINAL', 'DISTRIBUTOR'], description: 'Obrigatório se USD' },
  freight: { type: Type.NUMBER, description: 'Frete, na moeda do orçamento' },
  discount: { type: Type.NUMBER, description: 'Desconto em valor absoluto, na moeda do orçamento' },
  notes: { type: Type.STRING },
}

// Peso por unidade e divisão por caixa são informados por SKU/nome do item; a
// API converte pro formato posicional que o banco guarda.
const orderItemProps: Record<string, Schema> = {
  pesosPorItem: {
    type: Type.ARRAY,
    description: 'Kg/Un: peso por unidade de cada item do orçamento',
    items: {
      type: Type.OBJECT,
      properties: {
        item: { type: Type.STRING, description: 'SKU ou nome exato do item, como veio em buscar_orcamentos' },
        kgPorUnidade: { type: Type.NUMBER },
      },
      required: ['item', 'kgPorUnidade'],
    },
  },
  caixas: {
    type: Type.ARRAY,
    description:
      'O que vai em cada caixa, do jeito que a pessoa falar. Item que não está no orçamento é aceito como item avulso e sai destacado no cartão.',
    items: {
      type: Type.OBJECT,
      properties: {
        caixa: { type: Type.NUMBER, description: 'Número da caixa, começando em 1' },
        itens: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { item: { type: Type.STRING }, quantidade: { type: Type.NUMBER } },
            required: ['item', 'quantidade'],
          },
        },
      },
      required: ['caixa', 'itens'],
    },
  },
}

const writeTools: FunctionDeclaration[] = [
  {
    name: 'criar_tarefa',
    description:
      'Cria uma tarefa no quadro pessoal (Minha Pro Delphus) de quem está conversando com você — GRAVA NA HORA, sem prévia nem confirmação (diferente das ferramentas "propor_*"): é um lembrete pessoal, não um documento comercial. Use quando pedirem pra anotar, lembrar ou criar uma tarefa/pendência.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING },
        notas: { type: Type.STRING },
        clienteNome: { type: Type.STRING, description: 'Nome do cliente relacionado, se houver — texto livre' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        prazo: { type: Type.STRING, description: 'Data limite, formato AAAA-MM-DD' },
        coluna: { type: Type.STRING, description: 'Nome da coluna do quadro a usar; se não informar, usa a primeira' },
        orcamentoId: { type: Type.STRING, description: 'Id do orçamento relacionado (de buscar_orcamentos), se houver' },
        pedidoId: { type: Type.STRING, description: 'Id do pedido relacionado (de buscar_pedidos), se houver' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'propor_orcamento',
    description:
      'Monta uma prévia de orçamento novo — NÃO grava nada. Antes, tenha confirmado com a pessoa: cliente, itens (productId real de buscar_produtos) e quantidades, se é nacional ou internacional e, se internacional, moeda, idioma e (em USD) preço final ou distribuidor. Se a ferramenta devolver "erro", pergunte o que falta.',
    parameters: { type: Type.OBJECT, properties: { ...quoteFieldsProps }, required: ['clientName', 'items'] },
  },
  {
    name: 'propor_edicao_orcamento',
    description:
      'Monta uma prévia de edição de um orçamento existente — NÃO grava nada. Substitui o orçamento inteiro: pegue os dados atuais com buscar_orcamentos e mande todos os campos e itens, só com as mudanças pedidas aplicadas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orcamentoId: { type: Type.STRING },
        ...quoteFieldsProps,
        items: { type: Type.ARRAY, items: editItemSchema },
        confirmCompletedOrders: { type: Type.BOOLEAN, description: 'true só depois de avisar a pessoa que existe pedido concluído vinculado e ela autorizar' },
      },
      required: ['orcamentoId', 'clientName', 'items'],
    },
  },
  {
    name: 'propor_pedido',
    description:
      'Monta uma prévia de pedido novo a partir de um orçamento (quoteId de buscar_orcamentos) — NÃO grava nada. orderedByEmail/billToText/shipToText vêm do cadastro do cliente vinculado quando existirem; só informe se faltarem ou a pessoa pedir outro valor. Todo o resto você PERGUNTA numa mensagem só (caixas, pagamento, pesos, incoterms ou forma de envio, AWB, pedido de compra, data de expedição, Kg/Un, NF e data da NF, e o que vai em cada caixa); pessoaAutorizouPadrao=true só se a pessoa disser explicitamente que pode deixar em branco/usar o padrão. A taxa do PayPal é exceção: pergunte numa mensagem separada, depois de ela dizer que o pagamento é PayPal.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        quoteId: { type: Type.STRING },
        orderedByEmail: { type: Type.STRING },
        billToText: { type: Type.STRING, description: 'Endereço de cobrança completo' },
        shipToText: { type: Type.STRING, description: 'Endereço de entrega completo' },
        packageCount: { type: Type.NUMBER, description: 'Número de caixas' },
        prepaymentBy: { type: Type.STRING, enum: ['PAYPAL', 'WIRE_TRANSFER', 'PIX'] },
        paypalFee: { type: Type.NUMBER, description: 'Taxa do PayPal. Só quando o pagamento é PayPal, e perguntada numa mensagem separada' },
        incoterms: { type: Type.STRING, description: 'Só internacional, ex. EXW, DAP, DDP' },
        shippingMethod: { type: Type.STRING, description: 'Só nacional, ex. SEDEX, PAC, transportadora' },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
        awbNumber: { type: Type.STRING, description: 'AWB do envio' },
        purchaseOrder: { type: Type.STRING, description: 'Pedido de compra do cliente' },
        shipDate: { type: Type.STRING, description: 'Data de expedição, formato AAAA-MM-DD' },
        nfNumber: { type: Type.STRING, description: 'Número da nota fiscal' },
        nfDate: { type: Type.STRING, description: 'Data da nota fiscal, formato AAAA-MM-DD' },
        ...orderItemProps,
        pessoaAutorizouPadrao: { type: Type.BOOLEAN, description: 'true só se a pessoa autorizou explicitamente usar padrão/deixar em branco o que falta (nunca vale pra taxa do PayPal)' },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'propor_edicao_pedido',
    description: 'Monta uma prévia de edição de um pedido existente (pedidoId de buscar_pedidos) — NÃO grava nada. Mande só os campos que mudam.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pedidoId: { type: Type.STRING },
        packageCount: { type: Type.NUMBER },
        prepaymentBy: { type: Type.STRING, enum: ['PAYPAL', 'WIRE_TRANSFER', 'PIX'] },
        paypalFee: { type: Type.NUMBER },
        incoterms: { type: Type.STRING },
        shippingMethod: { type: Type.STRING },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
        awbNumber: { type: Type.STRING },
        purchaseOrder: { type: Type.STRING },
        shipDate: { type: Type.STRING, description: 'AAAA-MM-DD' },
        nfNumber: { type: Type.STRING },
        nfDate: { type: Type.STRING, description: 'AAAA-MM-DD' },
        ...orderItemProps,
        billToText: { type: Type.STRING },
        shipToText: { type: Type.STRING },
        orderedByEmail: { type: Type.STRING },
      },
      required: ['pedidoId'],
    },
  },
  {
    name: 'propor_cliente',
    description:
      'Monta uma prévia de cadastro de um cliente novo — NÃO grava nada. Só o nome é obrigatório; o resto é o que a pessoa foi contando na conversa (ver o passo 1 do processo comercial) — não invente endereço, e-mail ou telefone que ninguém disse.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        kind: { type: Type.STRING, enum: ['INDIVIDUAL', 'INSTITUTION', 'DISTRIBUTOR'] },
        institution: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        country: { type: Type.STRING },
        billToText: { type: Type.STRING, description: 'Endereço de cobrança completo' },
        shipToText: { type: Type.STRING, description: 'Endereço de entrega completo' },
        sectors: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Setores/áreas de interesse do cliente' },
        inService: { type: Type.BOOLEAN, description: 'Cliente "em atendimento" (negociação ativa agora)' },
        notes: { type: Type.STRING },
      },
      required: ['name'],
    },
  },
  {
    name: 'propor_edicao_cliente',
    description:
      'Monta uma prévia de edição de um cliente existente (clienteId de buscar_cliente) — NÃO grava nada. Mande só os campos que mudam. notes SUBSTITUI a observação inteira: pra acrescentar algo, mande a observação atual + o texto novo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clienteId: { type: Type.STRING },
        name: { type: Type.STRING },
        institution: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        country: { type: Type.STRING },
        billToText: { type: Type.STRING, description: 'Endereço de cobrança completo' },
        shipToText: { type: Type.STRING, description: 'Endereço de entrega completo' },
        inService: { type: Type.BOOLEAN, description: 'Cliente "em atendimento"' },
        notes: { type: Type.STRING },
      },
      required: ['clienteId'],
    },
  },
]

function toolArgs<T>(args: Record<string, unknown>) {
  return args as unknown as T
}

// `args` chega como JSON dinâmico vindo do Gemini. As ferramentas continuam
// sendo a fronteira de validação Zod; aqui os tipos são derivados das próprias
// assinaturas para o dispatcher não criar uma segunda definição de payload.
async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<{ result: unknown; pendingAction?: Awaited<ReturnType<typeof proporOrcamento>>['pendingAction'] }> {
  switch (name) {
    case 'buscar_produtos':
      return { result: await buscarProdutos(toolArgs<Parameters<typeof buscarProdutos>[0]>(args)) }
    case 'listar_clientes':
      return { result: await listarClientes(toolArgs<Parameters<typeof listarClientes>[0]>(args)) }
    case 'buscar_cliente':
      return { result: await buscarCliente(toolArgs<Parameters<typeof buscarCliente>[0]>(args)) }
    case 'listar_setores':
      return { result: await listarSetores() }
    case 'buscar_orcamentos':
      return { result: await buscarOrcamentos(toolArgs<Parameters<typeof buscarOrcamentos>[0]>(args)) }
    case 'buscar_pedidos':
      return { result: await buscarPedidos(toolArgs<Parameters<typeof buscarPedidos>[0]>(args)) }
    case 'verificar_pendencias':
      return { result: await verificarPendencias() }
    case 'criar_tarefa':
      return { result: await criarTarefa(toolArgs<Parameters<typeof criarTarefa>[0]>(args), userId) }
    case 'propor_orcamento': {
      const { pendingAction, summaryForModel } = await proporOrcamento(toolArgs<Parameters<typeof proporOrcamento>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_orcamento': {
      const { pendingAction, summaryForModel } = await proporEdicaoOrcamento(toolArgs<Parameters<typeof proporEdicaoOrcamento>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_pedido': {
      const { pendingAction, summaryForModel } = await proporPedido(toolArgs<Parameters<typeof proporPedido>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_pedido': {
      const { pendingAction, summaryForModel } = await proporEdicaoPedido(toolArgs<Parameters<typeof proporEdicaoPedido>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_cliente': {
      const { pendingAction, summaryForModel } = await proporCliente(toolArgs<Parameters<typeof proporCliente>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_cliente': {
      const { pendingAction, summaryForModel } = await proporEdicaoCliente(toolArgs<Parameters<typeof proporEdicaoCliente>[0]>(args), userId)
      return { result: summaryForModel, pendingAction }
    }
    default:
      throw new HttpError(500, `Ferramenta desconhecida: ${name}`)
  }
}

neoRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const message = String(req.body?.message ?? '').trim()
    if (!message) throw new HttpError(400, 'Mensagem vazia')
    const historyIn = Array.isArray(req.body?.history) ? req.body.history : []

    const contents: Content[] = [
      ...historyIn.map((h: { role: string; text: string }) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] },
    ]

    let pendingAction: ReturnType<typeof toPublicPendingAction> | undefined

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await generateNeoContent({
        model: env.GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: buildNeoSystemInstruction(),
          tools: [{ functionDeclarations: [...readTools, ...writeTools] }],
        },
      })

      const calls = response.functionCalls ?? []
      if (calls.length === 0) {
        res.json({ reply: redactInternalIds(response.text ?? ''), pendingAction })
        return
      }

      // Reaproveita o `content` que o próprio Gemini devolveu (em vez de
      // reconstruir só com `functionCall`), porque modelos 3.x anexam um
      // `thoughtSignature` por parte — descartá-lo quebra a continuidade do
      // raciocínio nas próximas iterações do loop de tool calling.
      contents.push(response.candidates?.[0]?.content ?? { role: 'model', parts: calls.map((c) => ({ functionCall: c })) })

      const responseParts = []
      for (const call of calls) {
        if (!IS_PRODUCTION) console.info(`[neo] ${call.name}`, JSON.stringify(call.args ?? {}))
        let result: unknown
        try {
          const dispatched = await dispatchTool(call.name!, call.args ?? {}, req.user!.id)
          result = dispatched.result
          if (dispatched.pendingAction) pendingAction = toPublicPendingAction(dispatched.pendingAction)
        } catch (err) {
          const forModel = toolErrorForModel(err)
          if (!forModel) throw err
          result = forModel
        }
        responseParts.push({ functionResponse: { name: call.name!, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    // Estourou o teto de ferramentas: em vez de devolver erro (o que joga fora
    // tudo que já foi apurado), pede uma resposta final sem ferramentas — o
    // modelo conclui com o que tem, ou pergunta.
    const finalResponse = await generateNeoContent({
      model: env.GEMINI_MODEL,
      contents: [
        ...contents,
        { role: 'user', parts: [{ text: 'Responda agora em texto, sem chamar mais ferramentas, com o que você já apurou. Se ainda falta informação, pergunte.' }] },
      ],
      config: { systemInstruction: buildNeoSystemInstruction() },
    })
    res.json({ reply: redactInternalIds(finalResponse.text ?? ''), pendingAction })
  }),
)

neoRouter.post(
  '/voz',
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!env.GROQ_API_KEY) throw new HttpError(503, 'Ditado por voz não está configurado neste servidor.')
    if (!req.file) throw new HttpError(400, 'Nenhum áudio enviado.')

    const extension = AUDIO_EXTENSION[req.file.mimetype] ?? 'webm'
    const form = new FormData()
    // Uint8Array(buffer) copia pra um ArrayBuffer normal — o Buffer do multer
    // é ArrayBufferLike (podendo ser SharedArrayBuffer), e o Blob global exige
    // o tipo mais estrito.
    form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), `ditado.${extension}`)
    form.append('model', 'whisper-large-v3-turbo')
    form.append('language', 'pt')
    form.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[neo] falha ao transcrever com Groq:', response.status, detail)
      if (response.status === 429) {
        throw new HttpError(503, 'O reconhecimento de voz atingiu o limite de uso por agora. Tenta de novo em instantes.')
      }
      throw new HttpError(502, 'Não deu para transcrever o áudio agora. Tenta de novo.')
    }

    const data = (await response.json()) as { text?: string }
    res.json({ text: (data.text ?? '').trim() })
  }),
)

neoRouter.post(
  '/actions/:id/confirm',
  asyncHandler(async (req, res) => {
    const action = getPendingAction(req.params.id, req.user!.id)
    if (!action) throw new HttpError(404, 'Essa ação expirou ou não existe mais. Peça pro NEO montar de novo.')

    switch (action.kind) {
      case 'orcamento_criar': {
        const quote = await createQuoteRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'quote', quote: toQuoteDTO(quote) })
        return
      }
      case 'orcamento_editar': {
        const { orcamentoId, data } = action.payload as { orcamentoId: string; data: unknown }
        const quote = await updateQuoteRecord(orcamentoId, data as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'quote', quote: toQuoteDTO(quote) })
        return
      }
      case 'pedido_criar': {
        const order = await createOrderRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'order', order: await toOrderDTOFresh(order) })
        return
      }
      case 'pedido_editar': {
        const { pedidoId, data } = action.payload as { pedidoId: string; data: unknown }
        const order = await updateOrderRecord(pedidoId, data as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'order', order: await toOrderDTOFresh(order) })
        return
      }
      case 'cliente_criar': {
        const client = await createClientRecord(action.payload as never, req.user!.id)
        discardPendingAction(action.id)
        res.json({ resource: 'client', client: toClientDTO(client) })
        return
      }
      case 'cliente_editar': {
        const { clienteId, data } = action.payload as { clienteId: string; data: unknown }
        const { client, aggregate } = await updateClientRecord(clienteId, data as never)
        discardPendingAction(action.id)
        res.json({ resource: 'client', client: toClientDTO(client, aggregate) })
        return
      }
    }
  }),
)

neoRouter.post(
  '/actions/:id/cancel',
  asyncHandler(async (req, res) => {
    const action = getPendingAction(req.params.id, req.user!.id)
    if (action) discardPendingAction(action.id)
    res.status(204).send()
  }),
)
