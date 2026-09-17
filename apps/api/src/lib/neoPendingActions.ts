import { randomUUID } from 'node:crypto'

export type PendingActionKind = 'orcamento_criar' | 'orcamento_editar' | 'pedido_criar' | 'pedido_editar' | 'cliente_editar'

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

export function toPublicPendingAction(action: PendingAction) {
  return { id: action.id, kind: action.kind, summary: action.summary, payload: action.payload }
}
