import { Router } from 'express'
import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from '@google/genai'
import { env } from '../lib/env.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { buildNeoSystemInstruction } from '../lib/neoKnowledge.js'
import { toPublicPendingAction, getPendingAction, discardPendingAction } from '../lib/neoPendingActions.js'
import {
  buscarProdutos,
  listarClientes,
  buscarCliente,
  listarSetores,
  proporOrcamento,
  proporEdicaoOrcamento,
  proporPedido,
  proporEdicaoPedido,
  proporEdicaoCliente,
} from '../lib/neoTools.js'
import { toQuoteDTO, toClientDTO } from '../lib/dto.js'
import { createQuoteRecord, updateQuoteRecord } from './quotes.routes.js'
import { createOrderRecord, updateOrderRecord, toOrderDTOFresh } from './orders.routes.js'
import { updateClientRecord } from './clients.routes.js'

export const neoRouter = Router()
neoRouter.use(requireAuth)

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = 'gemini-2.5-flash'
const MAX_TOOL_ITERATIONS = 5

const readTools: FunctionDeclaration[] = [
  {
    name: 'buscar_produtos',
    description: 'Busca produtos ativos do catálogo por setor(es) e/ou texto livre. Devolve nome, SKU, tipo, setores e todos os preços.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        setores: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Nomes de setor, pode incluir vários (inclusive correlatos)' },
        texto: { type: Type.STRING, description: 'Texto livre pra buscar no nome/descrição do produto' },
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
    description: 'Busca um cliente específico pelo nome.',
    parameters: { type: Type.OBJECT, properties: { nome: { type: Type.STRING } }, required: ['nome'] },
  },
  {
    name: 'listar_setores',
    description: 'Lista todos os setores/áreas médicas do catálogo.',
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

const quoteFieldsProps = {
  clientName: { type: Type.STRING },
  clientId: { type: Type.STRING, description: 'Id do cliente cadastrado, se houver' },
  items: { type: Type.ARRAY, items: itemSchema },
  currency: { type: Type.STRING, description: 'BRL, USD ou EUR' },
  priceTier: { type: Type.STRING, description: 'FINAL ou DISTRIBUTOR' },
  exportScope: { type: Type.STRING, description: 'NATIONAL ou INTERNATIONAL' },
  notes: { type: Type.STRING },
}

const writeTools: FunctionDeclaration[] = [
  {
    name: 'propor_orcamento',
    description: 'Monta uma prévia de orçamento novo — NÃO grava nada. Só chame depois de ter cliente e itens confirmados na conversa.',
    parameters: { type: Type.OBJECT, properties: { ...quoteFieldsProps }, required: ['clientName', 'items'] },
  },
  {
    name: 'propor_edicao_orcamento',
    description: 'Monta uma prévia de edição de um orçamento existente — NÃO grava nada.',
    parameters: { type: Type.OBJECT, properties: { orcamentoId: { type: Type.STRING }, ...quoteFieldsProps }, required: ['orcamentoId', 'clientName', 'items'] },
  },
  {
    name: 'propor_pedido',
    description:
      'Monta uma prévia de pedido novo a partir de um orçamento — NÃO grava nada. orderedByEmail/billToText/shipToText são opcionais aqui porque são preenchidos automaticamente a partir do cliente vinculado ao orçamento quando existirem; só informe se o cliente não tiver esses dados ou a pessoa pedir outro valor.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        quoteId: { type: Type.STRING },
        orderedByEmail: { type: Type.STRING },
        billToText: { type: Type.STRING },
        shipToText: { type: Type.STRING },
        packageCount: { type: Type.NUMBER },
        prepaymentBy: { type: Type.STRING, description: 'PAYPAL, WIRE_TRANSFER ou PIX' },
        incoterms: { type: Type.STRING },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
      },
      required: ['quoteId'],
    },
  },
  {
    name: 'propor_edicao_pedido',
    description: 'Monta uma prévia de edição de um pedido existente — NÃO grava nada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pedidoId: { type: Type.STRING },
        packageCount: { type: Type.NUMBER },
        prepaymentBy: { type: Type.STRING },
        incoterms: { type: Type.STRING },
        netWeightKg: { type: Type.NUMBER },
        grossWeightKg: { type: Type.NUMBER },
      },
      required: ['pedidoId'],
    },
  },
  {
    name: 'propor_edicao_cliente',
    description: 'Monta uma prévia de edição de um cliente existente — NÃO grava nada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clienteId: { type: Type.STRING },
        name: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        inService: { type: Type.BOOLEAN },
        notes: { type: Type.STRING },
      },
      required: ['clienteId'],
    },
  },
]

// `args` chega como JSON dinâmico vindo do Gemini — sem tipo estático real.
// Cada `proporX`/`buscarX` já valida com Zod por dentro (ver Tasks 7/8), então
// o `as any` aqui só destrava o TypeScript; dado ruim ainda é pego na
// validação, não silenciosamente aceito.
async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<{ result: unknown; pendingAction?: Awaited<ReturnType<typeof proporOrcamento>>['pendingAction'] }> {
  switch (name) {
    case 'buscar_produtos':
      return { result: await buscarProdutos(args as any) }
    case 'listar_clientes':
      return { result: await listarClientes(args as any) }
    case 'buscar_cliente':
      return { result: await buscarCliente(args as any) }
    case 'listar_setores':
      return { result: await listarSetores() }
    case 'propor_orcamento': {
      const { pendingAction, summaryForModel } = await proporOrcamento(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_orcamento': {
      const { pendingAction, summaryForModel } = await proporEdicaoOrcamento(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_pedido': {
      const { pendingAction, summaryForModel } = await proporPedido(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_pedido': {
      const { pendingAction, summaryForModel } = await proporEdicaoPedido(args as any, userId)
      return { result: summaryForModel, pendingAction }
    }
    case 'propor_edicao_cliente': {
      const { pendingAction, summaryForModel } = await proporEdicaoCliente(args as any, userId)
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
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: buildNeoSystemInstruction(),
          tools: [{ functionDeclarations: [...readTools, ...writeTools] }],
        },
      })

      const calls = response.functionCalls ?? []
      if (calls.length === 0) {
        res.json({ reply: response.text ?? '', pendingAction })
        return
      }

      contents.push({ role: 'model', parts: calls.map((c) => ({ functionCall: c })) })

      const responseParts = []
      for (const call of calls) {
        const { result, pendingAction: newPending } = await dispatchTool(call.name!, call.args ?? {}, req.user!.id)
        if (newPending) pendingAction = toPublicPendingAction(newPending)
        responseParts.push({ functionResponse: { name: call.name!, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    throw new HttpError(500, 'O Neo não conseguiu concluir a resposta (muitas chamadas de ferramenta em sequência).')
  }),
)

neoRouter.post(
  '/actions/:id/confirm',
  asyncHandler(async (req, res) => {
    const action = getPendingAction(req.params.id, req.user!.id)
    if (!action) throw new HttpError(404, 'Essa ação expirou ou não existe mais. Peça pro Neo montar de novo.')

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
