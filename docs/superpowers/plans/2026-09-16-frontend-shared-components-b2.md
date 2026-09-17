# Biblioteca de Componentes Compartilhados — Parte 2 (Radix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a biblioteca de componentes compartilhados com os primitivos que precisam de acessibilidade/teclado difíceis de acertar do zero: `Tooltip`, `Tabs` e `Combobox`, usando Radix UI como base de interação, estilizados 100% com os tokens do projeto. Nenhum consumidor real ainda (mesma decisão de camada usada em `Alert`/`StatTile` na Parte 1) — wiring em página é Camada C.

**Architecture:** Terceiro plano da série. Constrói em cima de `feature/frontend-design-tokens` já com a Parte 1 mergeada (Spinner, Button danger/isLoading, Alert, StatTile, convenção de radius aplicada). Adiciona três dependências novas (`@radix-ui/react-tooltip`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`) — primitivos "headless" estáveis, cada um resolve só teclado/foco/posicionamento, sem estilo próprio. `Combobox` usa `@radix-ui/react-popover` para posicionamento + filtro/navegação por teclado escritos à mão (mais previsível que depender de uma lib de combobox de terceiros sem poder validar a API contra a documentação agora). **Descoberta da revisão final da Parte 1**: `apps/web/src/context/ToastContext.tsx` já é um toast completo e funcional, sem dependência — não precisa ser construído; só o ícone de erro dele ainda usa `brand` em vez de `danger` (Task 4 aqui, achado pequeno e correlato). `Dropdown/Menu` citado no spec como "avaliar" fica de fora deste plano — nenhum consumidor concreto foi identificado ainda (YAGNI).

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4. Novas dependências: `@radix-ui/react-tooltip`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`.

**Spec:** [docs/superpowers/specs/2026-09-16-frontend-premium-redesign-design.md](../specs/2026-09-16-frontend-premium-redesign-design.md) — seção "Camada B — Componentes compartilhados".

## Global Constraints

- Branch de trabalho nasce de `feature/frontend-design-tokens` já com a Parte 1 mergeada.
- Sem framework de teste automatizado. Verificação = `npm run build --workspace=apps/web` + `npm run lint --workspace=apps/web` + checagem visual manual via dev server **rodado manualmente de dentro do worktree** (nunca `preview_start {name:"web"}` — está com root errado neste ambiente).
- Se algum nome de prop do Radix usado neste plano não bater com os tipos TypeScript do pacote realmente instalado, o erro de build é a fonte da verdade — corrigir para o que o pacote instalado realmente exporta, não insistir no texto deste plano.
- Seguir a convenção de radius (`rounded-lg` controles, `rounded-2xl` conteúdo, `rounded-3xl` superfície flutuante) e a paleta já existente — sem cor nova.
- Nenhuma página é tocada neste plano (exceto o achado pequeno da Task 4, que é um Context, não uma página).

---

### Task 1: Instalar dependências Radix

**Files:**
- Modify: `apps/web/package.json`, `package-lock.json` (raiz)

- [ ] **Step 1:**
```bash
npm install @radix-ui/react-tooltip @radix-ui/react-tabs @radix-ui/react-popover --workspace=apps/web
```
- [ ] **Step 2:** `npm run build --workspace=packages/shared && npm run build --workspace=apps/web` — deve passar.
- [ ] **Step 3:** Commit: `git add apps/web/package.json package-lock.json && git commit -m "chore(web): add Radix UI primitives for Tooltip/Tabs/Combobox"`

---

### Task 2: `Tooltip`

**Files:**
- Create: `apps/web/src/components/ui/Tooltip.tsx`
- Modify: `apps/web/src/components/ui/index.ts`

**Interfaces:** `Tooltip({ content, children, side? }): JSX.Element` — `children` é o elemento-gatilho (precisa aceitar `asChild`, ou seja, ser um único elemento focável/hoverável). Inclui seu próprio `TooltipPrimitive.Provider` por instância (não exige provider global em `App.tsx`).

- [ ] **Step 1:** Criar `apps/web/src/components/ui/Tooltip.tsx`:
```tsx
import type { ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/cn'

/** Dica contextual acessível (Radix cuida de teclado/foco/posicionamento). */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="animate-fade-in z-50 rounded-lg bg-ink-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-ink-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
```
- [ ] **Step 2:** Adicionar em `index.ts`: `export { Tooltip } from './Tooltip'`
- [ ] **Step 3:** `npm run build --workspace=apps/web && npm run lint --workspace=apps/web`
- [ ] **Step 4:** Checagem visual manual: subir dev server manual no worktree, renderizar temporariamente `<Tooltip content="Teste">{<button>Passe o mouse</button>}</Tooltip>` numa página autenticada (ex. `Home.tsx`, revertido antes do commit), confirmar via browser tool que o balão aparece no hover com o conteúdo certo, some ao tirar o mouse. Descrever a observação concreta (não genérica) no relatório.
- [ ] **Step 5:** Commit: `git add apps/web/src/components/ui/Tooltip.tsx apps/web/src/components/ui/index.ts && git commit -m "feat(web): add Tooltip component"`

---

### Task 3: `Tabs`

**Files:**
- Create: `apps/web/src/components/ui/Tabs.tsx`
- Modify: `apps/web/src/components/ui/index.ts`

**Interfaces:** `Tabs<T>({ items, value, onChange, children, className }): JSX.Element`, `TabPanel({ value, children }): JSX.Element`. Visual da lista de abas espelha `SegmentedControl` (pílula branca no item ativo) — mesma linguagem de "seleção exclusiva" documentada na Parte 1 (Task 5 de lá).

- [ ] **Step 1:** Criar `apps/web/src/components/ui/Tabs.tsx`:
```tsx
import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
}

/** Abas com tabpanel real (ARIA + navegação por seta) — SegmentedControl não é isso, só parece. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  children,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  children: ReactNode
  className?: string
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <TabsPrimitive.List className="inline-flex items-center gap-1 rounded-lg bg-neutral-500/8 p-1">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'rounded-lg px-3 py-1 text-[13px] font-medium whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-200 ease-out',
              'text-neutral-600 hover:text-ink-900',
              'data-[state=active]:bg-white data-[state=active]:text-ink-900 data-[state=active]:shadow-sm',
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className="mt-4 focus:outline-none">
      {children}
    </TabsPrimitive.Content>
  )
}
```
- [ ] **Step 2:** Adicionar em `index.ts`: `export { Tabs, TabPanel, type TabItem } from './Tabs'`
- [ ] **Step 3:** `npm run build --workspace=apps/web && npm run lint --workspace=apps/web`
- [ ] **Step 4:** Checagem visual manual: renderizar temporariamente 2-3 abas com conteúdo diferente numa página autenticada, confirmar clique troca o painel, a pílula branca segue o item ativo, navegação por seta (←/→) funciona com foco no `TabsList`. Reverter antes do commit.
- [ ] **Step 5:** Commit: `git add apps/web/src/components/ui/Tabs.tsx apps/web/src/components/ui/index.ts && git commit -m "feat(web): add Tabs component"`

---

### Task 4: Achado pequeno — `ToastContext` usa `brand` para erro

**Files:**
- Modify: `apps/web/src/context/ToastContext.tsx`

**Contexto:** achado da revisão final da Parte 1 — o toast de erro usa a cor `brand` (mesma do CTA primário) em vez do token `danger` que existe desde a Camada A. Fora do escopo de componente `ui/`, mas é uma linha e está diretamente relacionado ao rollout do token de perigo — inclui aqui em vez de esperar a Camada C.

- [ ] **Step 1:** Abrir `apps/web/src/context/ToastContext.tsx`, achar o ícone/cor do toast de tom de erro (hoje `text-brand-600` ou equivalente) e trocar para `text-danger-600` (mesma troca já feita em `Form.tsx` na Parte 1). Se o arquivo usa uma cor de fundo também (`bg-brand-*`) para o toast de erro, trocar para o `bg-danger-*` equivalente.
- [ ] **Step 2:** `npm run build --workspace=apps/web && npm run lint --workspace=apps/web`
- [ ] **Step 3:** Checagem visual manual: disparar um toast de erro real na aplicação (ex. tentar uma ação que falha) ou renderizar temporariamente o toast de erro numa página, confirmar cor vermelha (danger), reverter se temporário.
- [ ] **Step 4:** Commit: `git add apps/web/src/context/ToastContext.tsx && git commit -m "fix(web): error toast uses danger token instead of brand"`

---

### Task 5: `Combobox`

**Files:**
- Create: `apps/web/src/components/ui/Combobox.tsx`
- Modify: `apps/web/src/components/ui/index.ts`

**Interfaces:** `Combobox<T extends string>({ options, value, onSelect, placeholder?, emptyMessage?, className }): JSX.Element`. Filtro por substring (case-insensitive) em `label`/`description`, navegação por seta + Enter, Escape fecha. Vai substituir os autocompletes hand-rolled de `NewQuote.tsx` e `ClientPicker.tsx` quando a Camada C tocar essas páginas — não são tocadas aqui.

- [ ] **Step 1:** Criar `apps/web/src/components/ui/Combobox.tsx`:
```tsx
import { useMemo, useState } from 'react'
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
  onSelect,
  placeholder = 'Buscar…',
  emptyMessage = 'Nada encontrado.',
  className,
}: {
  options: ComboboxOption<T>[]
  value?: T
  onSelect: (value: T) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    )
  }, [options, query])

  function select(option: ComboboxOption<T>) {
    onSelect(option.value)
    setQuery('')
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn('relative', className)}>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={open ? query : (selected?.label ?? '')}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
              if (!open) setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && filtered[activeIndex]) {
                e.preventDefault()
                select(filtered[activeIndex])
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-ink-900 shadow-xs',
              'placeholder:text-neutral-400',
              'transition-[border-color,box-shadow] duration-150 ease-out hover:border-neutral-300',
              'focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus-visible:outline-none',
            )}
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-2xl border border-neutral-200/70 bg-white p-1.5 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-neutral-500">{emptyMessage}</p>
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
                    i === activeIndex && 'bg-neutral-500/8',
                  )}
                >
                  <span className="font-medium text-ink-900">{option.label}</span>
                  {option.description && (
                    <span className="text-[12px] text-neutral-500">{option.description}</span>
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
```
- [ ] **Step 2:** Adicionar em `index.ts`: `export { Combobox, type ComboboxOption } from './Combobox'`
- [ ] **Step 3:** `npm run build --workspace=apps/web && npm run lint --workspace=apps/web`
- [ ] **Step 4:** Checagem visual manual: renderizar temporariamente com uns 5 `options` de teste numa página autenticada, confirmar: digitar filtra a lista, seta para baixo/cima move o destaque, Enter seleciona e fecha, Escape fecha sem selecionar, clique numa opção seleciona. Descrever cada interação testada com o resultado real observado. Reverter antes do commit.
- [ ] **Step 5:** Commit: `git add apps/web/src/components/ui/Combobox.tsx apps/web/src/components/ui/index.ts && git commit -m "feat(web): add Combobox component"`

---

## Self-Review Notes

- Cobertura: Tooltip, Tabs, Combobox (Camada B pendente) + achado do Toast (correlato). Dropdown/Menu fica de fora — sem consumidor concreto, YAGNI.
- `Combobox` não usa nenhuma lib de terceiros além do `@radix-ui/react-popover` já usado por `Tooltip`/`Tabs` — filtro e navegação por teclado escritos à mão para não depender de uma API de terceiro não verificável agora.
- Nenhum destes componentes tem consumidor real ainda — mesmo padrão da Parte 1 (`Alert`, `StatTile`'s `tone="neutral"`). Camada C deve dar um primeiro consumidor cedo a cada um, não no fim.
