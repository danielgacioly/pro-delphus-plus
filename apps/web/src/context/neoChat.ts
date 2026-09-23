import { api } from '../lib/api'

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

export interface PendingAction {
  id: string
  kind: 'orcamento_criar' | 'orcamento_editar' | 'pedido_criar' | 'pedido_editar' | 'cliente_criar' | 'cliente_editar'
  summary: string
}

export const KIND_LABEL: Record<PendingAction['kind'], string> = {
  orcamento_criar: 'Criar orçamento',
  orcamento_editar: 'Editar orçamento',
  pedido_criar: 'Criar pedido',
  pedido_editar: 'Editar pedido',
  cliente_criar: 'Criar cliente',
  cliente_editar: 'Editar cliente',
}

export async function sendMessage(message: string, history: ChatMessage[]) {
  const { data } = await api.post<{ reply: string; pendingAction?: PendingAction }>('/neo', {
    message,
    history: history.map((m) => ({ role: m.role, text: m.event ? `[Sistema] ${m.text}` : m.text })),
  })
  return data
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
