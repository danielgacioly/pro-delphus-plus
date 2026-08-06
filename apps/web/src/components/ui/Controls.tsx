import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconSearch } from '../icons'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

/**
 * Controle segmentado no estilo iOS: trilho recuado com a opção ativa
 * “levantada” numa pastilha branca.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fill,
  className,
  'aria-label': ariaLabel,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Distribui as opções igualmente na largura disponível. */
  fill?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-[10px] bg-neutral-500/8 p-1',
        fill && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[7px] px-3 py-1 text-[13px] font-medium whitespace-nowrap',
              'transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]',
              fill && 'flex-1',
              active
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-neutral-600 hover:text-ink-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Filtro booleano em pastilha — para alternâncias soltas como “Só meus”. */
export function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium',
        'transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97]',
        active
          ? 'border border-transparent bg-ink-900 text-white'
          : 'border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-ink-900',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-ink-900 shadow-xs',
          'placeholder:text-neutral-400',
          'transition-[border-color,box-shadow] duration-150 ease-out hover:border-neutral-300',
          'focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus-visible:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-500/15 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-500/25"
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Barra de filtros acima de uma tabela ou grade. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2.5', className)}>{children}</div>
}
