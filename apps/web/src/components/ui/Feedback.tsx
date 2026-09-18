import type { ComponentType, ReactNode, SVGProps } from 'react'
import { cn } from '../../lib/cn'
import { IconInbox } from '../icons'

/** Indicador de carregamento — herda a cor do texto via currentColor. Tailwind já traz `animate-spin`. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'ink'

// Preenchimento discreto e texto escuro o bastante para passar em AA — a
// pílula é rótulo de estado, não elemento decorativo.
const tones: Record<Tone, string> = {
  neutral: 'bg-black/[0.05] text-neutral-700',
  brand: 'bg-brand-500/10 text-brand-700',
  success: 'bg-emerald-600/10 text-emerald-800',
  warning: 'bg-amber-600/12 text-amber-800',
  ink: 'bg-black/[0.07] text-ink-800',
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone
  /** Mostra um ponto colorido — bom para status. */
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  const dotColor: Record<Tone, string> = {
    neutral: 'bg-neutral-600',
    brand: 'bg-brand-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    ink: 'bg-ink-800',
  }
  return (
    <span
      className={cn(
        'inline-flex h-[21px] items-center gap-1 rounded-md pr-1.5 text-[11.5px] font-medium tracking-[-0.005em] whitespace-nowrap',
        dot ? 'pl-1' : 'pl-1.5',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-[5px] w-[5px] shrink-0 rounded-full', dotColor[tone])} />}
      {children}
    </span>
  )
}

export function EmptyState({
  icon: Icon = IconInbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <Icon className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
      <p className="mt-3 text-[15px] font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-neutral-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

/** Linhas-fantasma com larguras variadas — parece conteúdo real carregando. */
export function SkeletonRows({ rows = 5, columns }: { rows?: number; columns: number }) {
  const widths = ['w-24', 'w-32', 'w-16', 'w-28', 'w-20', 'w-36', 'w-14', 'w-24', 'w-20']
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className={cn('h-3 max-w-full', widths[(r + c) % widths.length])} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
