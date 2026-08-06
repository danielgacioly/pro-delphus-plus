import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold ' +
  'transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md',
  secondary:
    'border border-neutral-200 bg-white text-ink-800 shadow-xs hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm',
  ghost: 'text-neutral-600 hover:bg-neutral-500/10 hover:text-ink-900',
  danger: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9.5 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
}

/** Mesma aparência do Button, mas navega (react-router Link). */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  to,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  )
}

/** Botão-ícone quadrado, para ações discretas em barras e cabeçalhos. */
export function IconButton({
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500',
        'transition-[transform,background-color,color] duration-150 ease-out',
        'hover:bg-neutral-500/10 hover:text-ink-900 active:scale-90',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
