import { randomUUID } from 'node:crypto'

export type PendingActionKind =
  | 'orcamento_criar'
  | 'orcamento_editar'
  | 'pedido_criar'
  | 'pedido_editar'
  | 'cliente_criar'
  | 'cliente_editar'
  | 'biblioteca_criar'

export interface PendingAction {
  id: string
  kind: PendingActionKind
  summary: string
  payload: unknown
  userId: string
  createdAt: number
}

const TTL_MS = 15 * 60 * 1000

const store = new Map<string, PendingAction>()

function isExpired(action: PendingAction) {
  return Date.now() - action.createdAt > TTL_MS
}

export function createPendingAction(kind: PendingActionKind, summary: string, payload: unknown, userId: string): PendingAction {
  // Proposta que ninguém confirmou nem cancelou só sai do mapa quando alguém
  // tenta buscá-la de novo — o que pode nunca acontecer. Limpar as vencidas a
  // cada nova proposta mantém o mapa no tamanho dos últimos 15 minutos, em vez
  // de crescer pelo tempo que o processo ficar de pé.
  for (const [id, pending] of store) {
    if (isExpired(pending)) store.delete(id)
  }
  const action: PendingAction = { id: randomUUID(), kind, summary, payload, userId, createdAt: Date.now() }
  store.set(action.id, action)
  return action
}

export function getPendingAction(id: string, userId: string): PendingAction | undefined {
  const action = store.get(id)
  if (!action) return undefined
  if (action.userId !== userId || isExpired(action)) {
    store.delete(action.id)
    return undefined
  }
  return action
}

export function discardPendingAction(id: string): void {
  store.delete(id)
}

// O NEO já é instruído a nunca escrever um id interno na resposta, mas isso é
// texto de modelo — não dá pra confiar só na instrução. Riscado aqui, no
// servidor, antes de qualquer texto (resposta do chat ou resumo do cartão de
// confirmação) sair pra tela. Só o texto passa por isto — `action.id` (o id
// da própria pending action, que o front usa pra confirmar/cancelar) e o
// `payload` (ids reais que a confirmação de fato precisa) não são tocados.
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

export function redactInternalIds(text: string): string {
  return text.replace(UUID_PATTERN, '(id interno)')
}

export function toPublicPendingAction(action: PendingAction) {
  return { id: action.id, kind: action.kind, summary: redactInternalIds(action.summary), payload: action.payload }
}
