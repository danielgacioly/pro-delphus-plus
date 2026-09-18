import { useEffect, useMemo, useRef, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/cn'
import { IconSearch } from '../icons'

export interface ComboboxOption<T extends string> {
  value: T
  label: string
  description?: string
}

/**
 * Campo de busca com sugestões filtradas e navegação por teclado — substitui
 * os autocompletes hand-rolled (produto em NewQuote, cliente em ClientPicker).
 */
export function Combobox<T extends string>({
  options,
  value,
  inputValue,
  onInputValueChange,
  onSelect,
  placeholder = 'Buscar…',
  emptyMessage = 'Nada encontrado.',
  className,
}: {
  options: ComboboxOption<T>[]
  value?: T
  inputValue?: string
  onInputValueChange?: (value: string) => void
  onSelect: (value: T) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const anchorRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  const displayedValue = open ? (inputValue ?? query) : (selected?.label ?? inputValue ?? '')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    )
  }, [options, query])

  // Recoloca activeIndex dentro dos limites se `filtered` encolher por fora
  // (ex.: options trocado após busca assíncrona), senão Enter fica sem alvo
  // até a próxima seta re-clampar.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  function select(option: ComboboxOption<T>) {
    onSelect(option.value)
    setQuery('')
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchorRef} className={cn('relative', className)}>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            onChange={(e) => {
              const nextValue = e.target.value
              setQuery(nextValue)
              onInputValueChange?.(nextValue)
              setActiveIndex(0)
              if (!open) setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            // onFocus não dispara de novo em cliques num input que já está
            // focado (ex.: clicar de novo após selecionar) — onClick cobre isso.
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && open) {
                // Sempre previne o default enquanto o dropdown está aberto —
                // senão, sem match, o Enter cai para o comportamento nativo
                // do <input> e submete um <form> ao redor (NewQuote, ClientPicker).
                e.preventDefault()
                if (filtered[activeIndex]) {
                  select(filtered[activeIndex])
                }
              } else if (e.key === 'Escape') {
                setOpen(false)
                // Evita que o Escape borbulhe para um Modal ao redor e o feche
                // também — aqui ele deve só fechar o dropdown do Combobox.
                e.stopPropagation()
              }
            }}
            value={displayedValue}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open}
            autoComplete="off"
            className={cn(
              'h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-ink-900 shadow-xs',
              'placeholder:text-neutral-500',
              'transition-[border-color,box-shadow] duration-150 ease-out hover:border-neutral-300',
              'focus:border-brand-400 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20 focus-visible:outline-none',
            )}
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // O <input> permanece focado (fora do Content, no Anchor) enquanto o
            // dropdown está aberto — sem essa guarda o DismissableLayer do Radix
            // interpreta esse foco/clique como "fora" e fecha imediatamente ao abrir.
            if (anchorRef.current?.contains(e.target as Node)) {
              e.preventDefault()
            }
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-xl border border-black/[0.08] bg-white p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-neutral-600">{emptyMessage}</p>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto">
              {filtered.map((option, i) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(option)}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-lg px-3 py-2 text-[13px]',
                    i === activeIndex && 'bg-neutral-500/14',
                  )}
                >
                  <span className="font-medium text-ink-900">{option.label}</span>
                  {option.description && (
                    <span className="text-[12px] text-neutral-600">{option.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
