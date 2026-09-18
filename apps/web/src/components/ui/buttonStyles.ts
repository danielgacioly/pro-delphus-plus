import { cn } from '../../lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md' | 'lg'


// Sem "encolher" no clique e sem sombra crescendo no hover: botão de macOS
// responde escurecendo, não pulando. O brilho interno de 0.5px no topo é o
// que dá o acabamento de botão de sistema ao preenchimento sólido.
export const base =
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium ' +
  'transition-[background-color,border-color,color,filter] duration-100 ease-out ' +
  'disabled:pointer-events-none disabled:opacity-40'

export const variants: Record<Variant, string> = {
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

export const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12.5px]',
  md: 'h-8 px-3.5 text-[13px]',
  lg: 'h-9 px-4 text-[14px]',
}

/**
 * Mesma receita visual do <Button>, para os casos que precisam ser um <a> de
 * verdade (download, abrir em nova aba) e por isso não podem usar o
 * componente. Evita que cada página reinvente a aparência do botão.
 */
export function buttonClasses(options: { variant?: Variant; size?: Size; className?: string } = {}) {
  const { variant = 'secondary', size = 'md', className } = options
  return cn(base, variants[variant], sizes[size], className)
}

