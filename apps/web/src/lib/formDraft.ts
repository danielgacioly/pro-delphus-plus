/**
 * Rascunho do formulário de novo orçamento / novo pedido, para não perder o
 * que foi preenchido ao sair da tela (consultar um preço, um cliente…).
 *
 * Um rascunho só por tipo e por usuário: começar outro orçamento a partir de
 * outro ponto (duplicar, "novo orçamento" de um cliente) sobrescreve o
 * anterior sem perguntar. Fica no navegador — é conveniência, não registro.
 */
export type DraftKind = 'quote' | 'order'

const VERSION = 1

function key(kind: DraftKind, userId: string) {
  return `prodelphus:draft:${kind}:${userId}`
}

export function loadDraft<T>(kind: DraftKind, userId: string | undefined): T | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(key(kind, userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v: number; data: T }
    return parsed.v === VERSION ? parsed.data : null
  } catch {
    return null
  }
}

export function saveDraft<T>(kind: DraftKind, userId: string | undefined, data: T) {
  if (!userId) return
  try {
    localStorage.setItem(key(kind, userId), JSON.stringify({ v: VERSION, data }))
  } catch {
    // Navegador sem armazenamento (aba anônima bloqueada, cota cheia): segue sem rascunho.
  }
}

export function clearDraft(kind: DraftKind, userId: string | undefined) {
  if (!userId) return
  try {
    localStorage.removeItem(key(kind, userId))
  } catch {
    // idem
  }
}
