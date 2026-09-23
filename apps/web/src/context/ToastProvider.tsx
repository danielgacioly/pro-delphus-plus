import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'
import { IconAlert, IconCheckCircle } from '../components/icons'
import { ToastContext, type ToastAction, type ToastContextValue } from './ToastContext'

type ToastTone = 'success' | 'error'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
  action?: ToastAction
}

const DURATION_MS = 3800
// Aviso com ação ("Ver") fica mais tempo: a pessoa está em outra tela e precisa notar.
const ACTION_DURATION_MS = 9000

const toneStyles: Record<ToastTone, { icon: typeof IconCheckCircle; iconClass: string }> = {
  success: { icon: IconCheckCircle, iconClass: 'text-emerald-500' },
  error: { icon: IconAlert, iconClass: 'text-danger-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string, action?: ToastAction) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, tone, message, action }])
      window.setTimeout(() => dismiss(id), action ? ACTION_DURATION_MS : DURATION_MS)
    },
    [dismiss],
  )

  const value: ToastContextValue = {
    success: (message, action) => push('success', message, action),
    error: (message, action) => push('error', message, action),
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
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick()
                      dismiss(t.id)
                    }}
                    className="shrink-0 rounded-md px-2 py-0.5 text-[12.5px] font-medium text-brand-600 transition-colors hover:bg-brand-50"
                  >
                    {t.action.label}
                  </button>
                )}
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
