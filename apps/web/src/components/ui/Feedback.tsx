import type { ComponentType, ReactNode, SVGProps } from 'react'
import { cn } from '../../lib/cn'
import { IconInbox } from '../icons'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'ink'

const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-500/10 text-neutral-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-500/12 text-emerald-700',
  warning: 'bg-amber-500/15 text-amber-700',
  ink: 'bg-ink-900/8 text-ink-800',
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
    neutral: 'bg-neutral-500',
    brand: 'bg-brand-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    ink: 'bg-ink-800',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColor[tone])} />}
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
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-500/8 text-neutral-400">
        <Icon className="h-5.5 w-5.5" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">{description}</p>}
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
