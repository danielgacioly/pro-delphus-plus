/**
 * Rascunho do formulário de novo orçamento / novo pedido, para não perder o
 * que foi preenchido ao sair da tela (consultar um preço, um cliente…).
 *
 * Um rascunho só por tipo e por usuário. "Novo orçamento" sempre começa em
 * branco e descarta o rascunho; para retomar, o aviso de rascunho em
 * andamento (DraftReminder) leva à tela com `?rascunho=1`. Fica no navegador
 * — é conveniência, não registro.
 */
export type DraftKind = 'quote' | 'order'

/** Parâmetro de URL que pede para a tela retomar o rascunho em vez de começar do zero. */
export const RESUME_DRAFT_PARAM = 'rascunho'

export const DRAFT_PATHS: Record<DraftKind, string> = {
  quote: '/orcamentos/novo',
  order: '/pedidos/novo',
}

const VERSION = 1

interface Stored<T> {
  v: number
  data: T
  /** Resumo curto para o aviso ("Dr. Fulano · 3 itens"). */
  label: string
  savedAt: number
}

function key(kind: DraftKind, userId: string) {
  return `prodelphus:draft:${kind}:${userId}`
}

function read<T>(kind: DraftKind, userId: string | undefined): Stored<T> | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(key(kind, userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored<T>
    return parsed.v === VERSION ? parsed : null
  } catch {
    return null
  }
}

export function loadDraft<T>(kind: DraftKind, userId: string | undefined): T | null {
  return read<T>(kind, userId)?.data ?? null
}

export function peekDraft(kind: DraftKind, userId: string | undefined): { label: string; savedAt: number } | null {
  const stored = read(kind, userId)
  return stored ? { label: stored.label, savedAt: stored.savedAt } : null
}

export function saveDraft<T>(kind: DraftKind, userId: string | undefined, data: T, label: string) {
  if (!userId) return
  try {
    const stored: Stored<T> = { v: VERSION, data, label, savedAt: Date.now() }
    localStorage.setItem(key(kind, userId), JSON.stringify(stored))
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
