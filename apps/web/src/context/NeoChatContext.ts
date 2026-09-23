/** Contexto da conversa com o NEO e o hook que o lê — separado do provider pelo mesmo motivo de `ToastContext.ts`. */
import { createContext, useContext } from 'react'
import type { ChatMessage, PendingAction } from './neoChat'

export interface NeoChatValue {
  messages: ChatMessage[]
  pending: PendingAction | null
  loading: boolean
  error: string | null
  setError: (message: string | null) => void
  send: (text: string) => Promise<void>
  confirm: () => Promise<void>
  cancel: () => Promise<void>
  newChat: () => void
}

export const NeoChatContext = createContext<NeoChatValue | undefined>(undefined)

export function useNeoChat() {
  const ctx = useContext(NeoChatContext)
  if (!ctx) throw new Error('useNeoChat deve ser usado dentro de NeoChatProvider')
  return ctx
}
