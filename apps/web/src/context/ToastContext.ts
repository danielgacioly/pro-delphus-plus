/**
 * O contexto de avisos e o hook que o lê. Separado do provider pelo mesmo
 * motivo de `authContext.ts`: arquivo que mistura componente e não-componente
 * quebra o fast refresh do Vite.
 */
import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastContextValue {
  /** Confirmação positiva e breve — "Orçamento salvo", não "Sucesso!". */
  success: (message: string, action?: ToastAction) => void
  /** Só para falhas que não têm um banner de erro melhor por perto. */
  error: (message: string, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
