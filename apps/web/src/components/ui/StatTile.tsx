import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

interface StatTileProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Se presente, o tile vira um link (react-router). */
  to?: string
  tone?: 'brand' | 'neutral'
  delay?: number
  className?: string
}

/**
 * Card de métrica — rótulo pequeno em maiúsculas + valor grande tabular,
 * com ícone opcional e, opcionalmente, como link. Consolida o que antes
 * eram três implementações quase idênticas (Home, Stats, MyDesk) — Home
 * ficou de fora por ser um padrão diferente (ver plano).
 */
export function StatTile({ icon: Icon, label, value, sub, to, tone = 'brand', delay = 0, className }: StatTileProps) {
  const content = (
    <>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              tone === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-neutral-500/8 text-ink-800',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <p className="text-eyebrow text-neutral-400">{label}</p>
      </div>
      <p className="tabular mt-2.5 text-[26px] font-bold leading-none text-ink-900">
        {value}
        {sub && <span className="ml-1.5 text-[15px] font-normal text-neutral-400">{sub}</span>}
      </p>
    </>
  )

  const classes = cn(
    'animate-fade-in-up rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm',
    'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg',
    to && tone === 'brand' && 'hover:border-brand-200',
    className,
  )

  if (to) {
    return (
      <Link to={to} style={{ animationDelay: `${delay}ms` }} className={cn('group block', classes)}>
        {content}
      </Link>
    )
  }

  return (
    <div style={{ animationDelay: `${delay}ms` }} className={classes}>
      {content}
    </div>
  )
}
