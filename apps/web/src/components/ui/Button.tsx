import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Spinner } from './Feedback'
import { base, sizes, variants, type Size, type Variant } from './buttonStyles'

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  children,
  ...props
}: CommonProps & { isLoading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
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
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        variants.ghost,
        'text-neutral-600 hover:text-ink-900',
        'transition-[background-color,color] duration-100 ease-out',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
