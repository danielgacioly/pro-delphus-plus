import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/cn'
import { control } from './Form'
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
  filterOptions = true,
  className,
}: {
  options: ComboboxOption<T>[]
  value?: T
  inputValue?: string
  onInputValueChange?: (value: string) => void
  onSelect: (value: T) => void
  placeholder?: string
  emptyMessage?: string
  /**
   * `false` quando a lista já vem filtrada de fora (busca no servidor). Sem
   * isso o filtro local peneira de novo, só por `label`/`description`, e
   * esconde resultado legítimo que casou por outro campo no servidor.
   */
  filterOptions?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const anchorRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  const displayedValue = open ? (inputValue ?? query) : (selected?.label ?? inputValue ?? '')

  const filtered = useMemo(() => {
    if (!filterOptions) return options
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    )
  }, [filterOptions, options, query])

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
                if (!open) {
                  setOpen(true)
                  return
                }
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
            aria-controls={listId}
            aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            // Mesma receita dos outros campos: um campo de busca que destoa
            // em altura e borda denuncia o formulário inteiro.
            className={cn(control, 'h-9 w-full pl-9 pr-3')}
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
            <ul role="listbox" id={listId} className="max-h-64 overflow-y-auto">
              {filtered.map((option, i) => (
                <li
                  key={option.value}
                  id={`${listId}-${i}`}
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
