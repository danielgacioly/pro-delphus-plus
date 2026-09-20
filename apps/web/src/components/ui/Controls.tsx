import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconSearch } from '../icons'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

/**
 * Controle segmentado no estilo macOS: trilho cinza recuado com a opção ativa
 * numa pastilha branca com traço fino.
 *
 * Convenção de “estado selecionado/ativo” no app (documentada aqui por ser
 * o primeiro primitivo do arquivo; vale também para Badge.tsx):
 *   - Controle de alternância exclusiva num trilho (como este SegmentedControl):
 *     pastilha branca sobre o item ativo.
 *   - Filtro booleano solto: preenchimento sólido bg-ink-900 quando ativo.
 *   - Rótulo de status/contagem (Badge, em Feedback.tsx): tom suave da cor
 *     semântica, nunca preenchimento sólido.
 * Três linguagens visuais diferentes de propósito — cada uma sinaliza um
 * tipo de “seleção” distinto (modo exclusivo vs. filtro vs. rótulo
 * informativo). Não unificar visualmente sem necessidade real de produto.
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
        'inline-flex h-8 items-center gap-0.5 rounded-lg bg-black/[0.055] p-0.5',
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
              'flex h-7 items-center justify-center rounded-md px-3 text-[13px] whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-150 ease-out',
              fill && 'flex-1',
              active
                ? 'bg-white font-medium text-ink-900 shadow-[0_0.5px_2px_rgb(0_0_0/0.14),0_0_0_0.5px_rgb(0_0_0/0.05)]'
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

/**
 * Campo de busca de barra de ferramentas do macOS: preenchimento cinza em vez
 * de borda, que só vira campo branco com anel quando recebe foco.
 */
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
      <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-neutral-600" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-8 w-full rounded-lg border border-transparent bg-black/[0.055] pl-8 pr-7 text-[13.5px] text-ink-900',
          'placeholder:text-neutral-600',
          'transition-[background-color,border-color,box-shadow] duration-100 ease-out hover:bg-black/[0.07]',
          'focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-brand-500/20 focus-visible:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-400 text-[11px] leading-none text-white transition-colors hover:bg-neutral-500"
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Barra de filtros acima de uma tabela ou grade. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
