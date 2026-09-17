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
 * Card de métrica — rótulo discreto + valor tabular. O número é o destaque;
 * o ícone, quando existe, é só um glifo pequeno ao lado do rótulo, não um
 * quadrado colorido competindo com o valor.
 */
export function StatTile({ icon: Icon, label, value, sub, to, tone = 'brand', delay = 0, className }: StatTileProps) {
  const content = (
    <>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn('h-3.5 w-3.5 shrink-0', tone === 'brand' ? 'text-brand-600' : 'text-neutral-500')} />}
        <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      </div>
      <p className="tabular mt-1.5 whitespace-nowrap text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
        {value}
        {sub && <span className="ml-1.5 text-[14px] font-normal tracking-normal text-neutral-500">{sub}</span>}
      </p>
    </>
  )

  const classes = cn(
    'animate-fade-in rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5',
    to && 'transition-[border-color,box-shadow] duration-150 ease-out hover:border-black/[0.12] hover:shadow-md',
    className,
  )

  if (to) {
    return (
      <Link to={to} style={{ animationDelay: `${delay}ms` }} className={cn('block', classes)}>
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
