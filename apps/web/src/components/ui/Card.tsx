import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Superfície base: branco sobre o fundo cinza do app, com traço fino. Sem
 * sombra — no fundo #f5f5f7 o próprio branco já destaca a superfície.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-black/[0.06] bg-white', className)} {...props} />
}

/** Card clicável: responde com um traço mais firme, sem "pular" na tela. */
export function InteractiveCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-black/[0.06] bg-white',
        'transition-[border-color,box-shadow] duration-150 ease-out',
        'hover:border-black/[0.12] hover:shadow-md',
        className,
      )}
      {...props}
    />
  )
}
