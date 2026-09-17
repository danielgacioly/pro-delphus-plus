import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Spinner } from './Feedback'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Sem "encolher" no clique e sem sombra crescendo no hover: botão de macOS
// responde escurecendo, não pulando. O brilho interno de 0.5px no topo é o
// que dá o acabamento de botão de sistema ao preenchimento sólido.
const base =
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium ' +
  'transition-[background-color,border-color,color,filter] duration-100 ease-out ' +
  'disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.22),0_0.5px_1px_rgb(0_0_0/0.18)] ' +
    'hover:bg-brand-700 active:brightness-95',
  secondary:
    'border border-black/[0.1] bg-white text-ink-900 shadow-[0_0.5px_1px_rgb(0_0_0/0.05)] ' +
    'hover:bg-neutral-50 active:bg-neutral-100',
  ghost: 'text-ink-800 hover:bg-black/[0.05] active:bg-black/[0.08]',
  danger:
    'bg-danger-600 text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.22),0_0.5px_1px_rgb(0_0_0/0.18)] ' +
    'hover:bg-danger-700 active:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12.5px]',
  md: 'h-8 px-3.5 text-[13px]',
  lg: 'h-9 px-4 text-[14px]',
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
        'text-neutral-500 hover:text-ink-900',
        'transition-[background-color,color] duration-100 ease-out',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
