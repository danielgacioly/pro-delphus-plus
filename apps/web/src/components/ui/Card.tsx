import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Superfície base: branco, cantos generosos, sombra suave em vez de borda pesada. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-neutral-200/70 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

/** Card clicável com elevação em hover. */
export function InteractiveCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-neutral-200/70 bg-white shadow-sm',
        'transition-[transform,box-shadow,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-neutral-200 hover:shadow-lg',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-heading text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
