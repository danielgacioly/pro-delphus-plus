import type { ComponentType, ReactNode, SVGProps } from 'react'
import { cn } from '../../lib/cn'
import { IconAlert, IconCheckCircle, IconInfo } from '../icons'

type Tone = 'error' | 'warning' | 'info' | 'success'

const tones: Record<Tone, { classes: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  error: { classes: 'bg-danger-50 text-danger-700', icon: IconAlert },
  warning: { classes: 'bg-amber-500/12 text-amber-700', icon: IconAlert },
  info: { classes: 'bg-brand-50 text-brand-700', icon: IconInfo },
  success: { classes: 'bg-emerald-500/12 text-emerald-700', icon: IconCheckCircle },
}

/**
 * Banner de aviso com ícone e tom semântico — substitui as divs ad hoc
 * (`bg-brand-50`/`bg-amber-500/1x`) espalhadas pelas páginas de formulário.
 * Referência de qualidade: o banner de mismatch em BoxAssignmentFields.tsx.
 */
export function Alert({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: Tone
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { classes, icon: Icon } = tones[tone]
  return (
    <div className={cn('animate-fade-in flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed', classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
