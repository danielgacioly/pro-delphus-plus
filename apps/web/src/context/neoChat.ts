import { api, getAccessToken, refreshAccessToken } from '../lib/api'

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
  // Resultado de um clique em Confirmar/Cancelar. Aparece como aviso, não como
  // bolha, mas vai no histórico: sem isso o NEO não sabia que o orçamento foi
  // criado (nem o número dele) e não conseguia seguir pro pedido.
  event?: 'done' | 'cancelled'
}

export type ConfirmResult =
  | { resource: 'quote'; quote: { quoteNumber: string } }
  | { resource: 'order'; order: { orderNumber: number } }
  | { resource: 'client'; client: { name: string } }
  | { resource: 'library'; entry: { question: string } }

export interface PendingAction {
  id: string
  kind:
    | 'orcamento_criar'
    | 'orcamento_editar'
    | 'pedido_criar'
    | 'pedido_editar'
    | 'cliente_criar'
    | 'cliente_editar'
    | 'biblioteca_criar'
  summary: string
}

export const KIND_LABEL: Record<PendingAction['kind'], string> = {
  orcamento_criar: 'Criar orçamento',
  orcamento_editar: 'Editar orçamento',
  pedido_criar: 'Criar pedido',
  pedido_editar: 'Editar pedido',
  cliente_criar: 'Criar cliente',
  cliente_editar: 'Editar cliente',
  biblioteca_criar: 'Cadastrar na Biblioteca',
}

/** Falha da conversa com uma mensagem já pronta para mostrar à pessoa. */
export class NeoStreamError extends Error {}

export interface StreamHandlers {
  /** O que o NEO está fazendo agora ("Buscando produtos…"). */
  onStatus: (text: string) => void
  /** Texto novo da resposta, conforme ele escreve. */
  onDelta: (text: string) => void
  /** O texto mostrado até aqui foi descartado. */
  onReset: () => void
}

type NeoEvent =
  | { type: 'status'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | {
      type: 'done'
      reply: string
      pendingAction?: PendingAction
      /** Gravado direto, sem cartão: a pessoa já tinha confirmado na mensagem. */
      executed?: { kind: PendingAction['kind']; result: ConfirmResult }
    }
  | { type: 'error'; message: string }

async function postNeo(body: string, token: string | null) {
  return fetch('/api/neo', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body,
  })
}

/**
 * Manda a pergunta e lê a resposta em streaming (uma linha JSON por evento).
 * `fetch` e não o axios: o axios no navegador só entrega a resposta inteira,
 * o que desfaria o ponto de mostrar o texto enquanto o NEO escreve.
 */
export async function streamMessage(message: string, history: ChatMessage[], handlers: StreamHandlers) {
  const body = JSON.stringify({
    message,
    history: history.map((m) => ({ role: m.role, text: m.event ? `[Sistema] ${m.text}` : m.text })),
  })
  let response = await postNeo(body, getAccessToken())
  // Mesmo tratamento do interceptor do axios: token de acesso vencido é
  // renovado uma vez antes de desistir.
  if (response.status === 401) {
    const token = await refreshAccessToken()
    if (token) response = await postNeo(body, token)
  }
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new NeoStreamError(data?.error ?? 'NEO não conseguiu responder agora. Tenta de novo em instantes.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as NeoEvent
      if (event.type === 'status') handlers.onStatus(event.text)
      else if (event.type === 'delta') handlers.onDelta(event.text)
      else if (event.type === 'reset') handlers.onReset()
      else if (event.type === 'done') return { reply: event.reply, pendingAction: event.pendingAction, executed: event.executed }
      else throw new NeoStreamError(event.message)
    }
    if (done) break
  }
  // Conexão caiu no meio (servidor reiniciou, rede oscilou) sem o evento final.
  throw new NeoStreamError('A conexão com o NEO caiu antes da resposta terminar. Tenta de novo.')
}

export async function confirmAction(id: string) {
  const { data } = await api.post<ConfirmResult>(`/neo/actions/${id}/confirm`)
  return data
}

export async function cancelAction(id: string) {
  await api.post(`/neo/actions/${id}/cancel`)
}

export function describeConfirmResult(kind: PendingAction['kind'], result: ConfirmResult) {
  const label = KIND_LABEL[kind]
  if (result.resource === 'quote') return `${label} — feito: orçamento ${result.quote.quoteNumber}.`
  if (result.resource === 'order') return `${label} — feito: pedido ${result.order.orderNumber}.`
  if (result.resource === 'library') return `${label} — feito: "${result.entry.question}".`
  return `${label} — feito: ${result.client.name}.`
}

// A conversa vive enquanto a aba viver: sair pra Orçamentos e voltar mantém o
// fio. sessionStorage e não localStorage de propósito — fechou o navegador,
// conversa nova.
export const STORAGE_KEY = 'neo:conversa'

export interface StoredChat {
  messages: ChatMessage[]
  pending: PendingAction | null
}

export function loadChat(): StoredChat {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { messages: [], pending: null }
    const parsed = JSON.parse(raw) as Partial<StoredChat>
    return { messages: parsed.messages ?? [], pending: parsed.pending ?? null }
  } catch {
    return { messages: [], pending: null }
  }
}
