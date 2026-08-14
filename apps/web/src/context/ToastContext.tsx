import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'
import { IconAlert, IconCheckCircle } from '../components/icons'

type ToastTone = 'success' | 'error'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  /** Confirmação positiva e breve — "Orçamento salvo", não "Sucesso!". */
  success: (message: string) => void
  /** Só para falhas que não têm um banner de erro melhor por perto. */
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DURATION_MS = 3800

const toneStyles: Record<ToastTone, { icon: typeof IconCheckCircle; iconClass: string }> = {
  success: { icon: IconCheckCircle, iconClass: 'text-emerald-500' },
  error: { icon: IconAlert, iconClass: 'text-brand-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, tone, message }])
      window.setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value: ToastContextValue = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => {
            const { icon: Icon, iconClass } = toneStyles[t.tone]
            return (
              <div
                key={t.id}
                role="status"
                className={cn(
                  'animate-fade-in-up pointer-events-auto flex items-start gap-2.5 rounded-xl border border-neutral-200/70 bg-white p-3.5 shadow-lg',
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} />
                <p className="flex-1 text-[13px] leading-relaxed text-ink-900">{t.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Fechar aviso"
                  className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-neutral-500/10 hover:text-ink-900"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
