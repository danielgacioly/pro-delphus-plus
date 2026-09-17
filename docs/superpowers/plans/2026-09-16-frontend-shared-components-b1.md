# Biblioteca de Componentes Compartilhados — Parte 1 (sem dependência nova) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consertar e completar a parte da biblioteca de componentes compartilhados (`apps/web/src/components/ui/*`) que não depende de nenhuma lib nova — variante `danger` real e estado de carregamento no `Button`, um `Spinner`, um `Alert`/`Banner` com variantes de tom, um `StatTile` único substituindo duas das três implementações duplicadas, a convenção de "estado selecionado" documentada, e a limpeza pontual (chevrons duplicados, `DropZone` sem teclado, `ConfirmDeleteModal` reimplementando `Button`/`Input`).

**Architecture:** Segundo plano da série de repaginada de front-end — constrói em cima da Camada A (fundação de tokens: `--color-danger-*`, convenção de radius/opacidade, `cn()` com `tailwind-merge` já ciente das classes tipográficas do projeto). Toca só `apps/web/src/components/ui/*`, `apps/web/src/components/icons.tsx`, `apps/web/src/components/DropZone.tsx`, `apps/web/src/components/ConfirmDeleteModal.tsx` e, para o `StatTile`, dois pontos de consumo mecânicos em `apps/web/src/pages/Stats.tsx` e `apps/web/src/pages/MyDesk.tsx` (troca de uma definição local por um import — não é redesign de página, que é trabalho da Camada C). Os componentes que precisam de uma lib de terceiros (Combobox, Tooltip, Toast, Tabs) ficam para um plano B2 separado.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4. Nenhuma dependência nova nesta parte.

**Spec:** [docs/superpowers/specs/2026-09-16-frontend-premium-redesign-design.md](../specs/2026-09-16-frontend-premium-redesign-design.md) — seção "Camada B — Componentes compartilhados".

## Global Constraints

- Este plano assume a Camada A já mergeada/disponível: a branch de trabalho deve nascer da ponta de `feature/frontend-design-tokens` (commit `fb57f3d`), não de `feature/neo-assistant` diretamente — ela tem a rampa `--color-danger-*`, o `cn()` com `extendTailwindMerge` reconhecendo `text-display/text-title/text-heading/text-eyebrow`, e os comentários de convenção de radius/opacidade que este plano usa.
- Sem framework de teste automatizado. Verificação = `npm run build --workspace=apps/web` (typecheck + build) + `npm run lint --workspace=apps/web` (oxlint) + checagem visual manual via dev server — **lembrar da regra da Camada A: nunca usar `preview_start {name:"web"}` para checar código de um worktree, sempre subir um servidor manual de dentro do worktree** (`cd apps/web && npx vite --port <livre> --strictPort`).
- Manter `color-scheme: light` — sem dark mode.
- Novas classes de cor devem vir das rampas já existentes (`brand`, `danger`, `neutral`, `ink`, `emerald`/`amber` do Tailwind padrão) — não inventar rampa nova sem necessidade.
- Seguir a convenção de radius da Camada A (`apps/web/src/index.css:61-70`): controles inline → `rounded-lg`; containers de conteúdo → `rounded-2xl`; superfícies flutuantes (modal, popover, toast) → `rounded-3xl`.
- Não redesenhar nenhuma página neste plano. Os dois pontos de contato com página (Task 4, `Stats.tsx`/`MyDesk.tsx`) são trocas mecânicas de uma definição local duplicada por um import do componente novo — mesma marcação visual, sem mudança de layout de página.

---

### Task 1: `Spinner`

**Files:**
- Modify: `apps/web/src/components/ui/Feedback.tsx` (adicionar `Spinner`, no mesmo arquivo que já tem `Skeleton`/`SkeletonRows` — outro primitivo de "estado de carregamento")
- Modify: `apps/web/src/components/ui/index.ts:6` (exportar `Spinner`)

**Interfaces:**
- Consumes: nada.
- Produces: `Spinner({ className }: { className?: string }): JSX.Element` — usa `currentColor`, então herda a cor de texto de quem o envolve (ex.: um botão `primary` com texto branco produz um spinner branco automaticamente). Consumido pela Task 2 (`Button` `isLoading`).

- [ ] **Step 1: Adicionar `Spinner` a `apps/web/src/components/ui/Feedback.tsx`**

Logo depois do import de `IconInbox` (linha 3) e antes de `type Tone` (linha 5), adicionar:

```tsx
/** Indicador de carregamento — herda a cor do texto via currentColor. Tailwind já traz `animate-spin`. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Exportar em `apps/web/src/components/ui/index.ts`**

Trocar a linha 6:
```ts
export { Badge, EmptyState, Skeleton, SkeletonRows } from './Feedback'
```
por:
```ts
export { Badge, EmptyState, Skeleton, SkeletonRows, Spinner } from './Feedback'
```

- [ ] **Step 3: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```
Ambos devem passar sem erro novo (só os warnings pré-existentes de `only-export-components`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/Feedback.tsx apps/web/src/components/ui/index.ts
git commit -m "feat(web): add Spinner loading indicator"
```

---

### Task 2: `Button` — variante `danger` real, estado `isLoading`, `IconButton` compõe `ghost`

**Files:**
- Modify: `apps/web/src/components/ui/Button.tsx` (arquivo inteiro, 79 linhas — reescrever)

**Interfaces:**
- Consumes: `Spinner` da Task 1 (`import { Spinner } from './Feedback'`).
- Produces: `Button` ganha prop `isLoading?: boolean` (desabilita o botão e mostra o spinner antes do conteúdo — mantém o texto visível para o botão não mudar de largura). `variant="danger"` agora usa `--color-danger-*` em vez de ser idêntico a `primary`. `ButtonLink` e `IconButton` mantêm suas assinaturas atuais (sem `isLoading` — um link não tem estado de carregamento HTML nativo; ficaria fora de escopo forçar isso agora). Task 8 (`ConfirmDeleteModal`) consome `variant="danger"`.

**Nota de revisão do plano:** o `h-9.5` do tamanho `md` (linha 23 hoje) **não é um bug** — é o ponto médio exato e deliberado entre `sm` (`h-8`=32px) e `lg` (`h-11`=44px), em passos de 6px (32/38/44), e `h-9.5` é uma utility Tailwind válida (múltiplo de 0.25rem), não um valor arbitrário via colchetes. Não mexer nele.

- [ ] **Step 1: Reescrever `apps/web/src/components/ui/Button.tsx`**

Conteúdo completo:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Spinner } from './Feedback'

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
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700 hover:shadow-md',
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
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        variants.ghost,
        'transition-[transform,background-color,color] duration-150 ease-out active:scale-90',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
```

Nota sobre `IconButton`: antes tinha `text-neutral-500` como cor ociosa; agora reaproveita `variants.ghost` (`text-neutral-600`), então a cor ociosa do ícone fica 1 tom mais escura — mudança visual mínima e intencional (elimina duplicação), não regressão.

- [ ] **Step 2: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 3: Checagem visual manual**

Suba um dev server de dentro do worktree (`cd apps/web && npx vite --port <livre> --strictPort` — **não** use `preview_start {name:"web"}`, ver Global Constraints) e confira:
- Algum botão com `variant="danger"` (ainda não existe nenhum na base até a Task 8 usar — pode testar temporariamente trocando um `variant="primary"` qualquer por `"danger"` numa página, conferir que fica vermelho puro (`--color-danger-600`, distinto do terracota do `primary`), depois desfazer a troca).
- O ícone do botão de recolher a sidebar (`Layout.tsx`, usa `IconButton` sem `className` de cor extra) continua com aparência e hover corretos.
- O botão de logout (`Layout.tsx`, `IconButton` com `hover:bg-brand-50 hover:text-brand-600` via `className`) continua sobrescrevendo a cor de hover corretamente (className vem depois de `variants.ghost` no `cn()`, então `tailwind-merge` já resolve a prioridade certa).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx
git commit -m "feat(web): real Button danger variant, isLoading state, dedupe IconButton hover styles"
```

---

### Task 3: `Alert`/`Banner` com variantes de tom

**Files:**
- Create: `apps/web/src/components/ui/Alert.tsx`
- Modify: `apps/web/src/components/ui/index.ts` (exportar)

**Interfaces:**
- Consumes: ícones já existentes `IconAlert`, `IconInfo`, `IconCheckCircle` de `../icons`; `cn` de `../../lib/cn`.
- Produces: `Alert({ tone, children, action, className }): JSX.Element`, `tone: 'error' | 'warning' | 'info' | 'success'` (default `'info'`). Não é consumido por nenhuma página neste plano (isso é trabalho da Camada C — ver spec, seção Camada C: `NewOrder`, `OrderDetail`, `ClientDetail` etc. têm banners ad hoc para migrar). A referência de qualidade é o banner de mismatch em [BoxAssignmentFields.tsx:58-77](../../../apps/web/src/components/BoxAssignmentFields.tsx) — mesma ideia (ícone + texto + tom condicional), generalizada em componente.

- [ ] **Step 1: Criar `apps/web/src/components/ui/Alert.tsx`**

```tsx
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { cn } from '../../lib/cn'
import { IconAlert, IconCheckCircle, IconInfo } from '../icons'

type Tone = 'error' | 'warning' | 'info' | 'success'

const tones: Record<Tone, { classes: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  error: { classes: 'bg-danger-50 text-danger-700', icon: IconAlert },
  warning: { classes: 'bg-amber-500/12 text-amber-700', icon: IconAlert },
  info: { classes: 'bg-brand-50 text-brand-700', icon: IconInfo },
  success: { classes: 'bg-emerald-500/12 text-emerald-700', icon: IconCheckCircle },
}

/**
 * Banner de aviso com ícone e tom semântico — substitui as divs ad hoc
 * (`bg-brand-50`/`bg-amber-500/1x`) espalhadas pelas páginas de formulário.
 * Referência de qualidade: o banner de mismatch em BoxAssignmentFields.tsx.
 */
export function Alert({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: Tone
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { classes, icon: Icon } = tones[tone]
  return (
    <div className={cn('animate-fade-in flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed', classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Exportar em `apps/web/src/components/ui/index.ts`**

Adicionar uma linha (posição livre, ex.: logo após a linha do `Badge`):
```ts
export { Alert } from './Alert'
```

- [ ] **Step 3: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 4: Checagem visual manual**

Suba um dev server manual no worktree. Temporariamente renderize as 4 variantes numa página já autenticada (ex.: cole em `Home.tsx` dentro do `<Page>`, antes do `</Page>` de fechamento — não faz parte do commit final):
```tsx
<div className="space-y-2">
  <Alert tone="error">Mensagem de erro.</Alert>
  <Alert tone="warning">Mensagem de aviso.</Alert>
  <Alert tone="info">Mensagem informativa.</Alert>
  <Alert tone="success">Mensagem de sucesso.</Alert>
</div>
```
Confirme visualmente as 4 cores/ícones corretos, depois **remova esse trecho antes de commitar** — confirme via `git status`/`git diff` que `Home.tsx` não aparece no commit final.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Alert.tsx apps/web/src/components/ui/index.ts
git commit -m "feat(web): add Alert banner component with tone variants"
```

---

### Task 4: `StatTile` — consolidar `Stats.tsx`/`MyDesk.tsx` (não `Home.tsx`)

**Files:**
- Create: `apps/web/src/components/ui/StatTile.tsx`
- Modify: `apps/web/src/components/ui/index.ts` (exportar)
- Modify: `apps/web/src/pages/Stats.tsx:136-149` (remover `StatCard` local, trocar as 8 chamadas por `StatTile` importado)
- Modify: `apps/web/src/pages/MyDesk.tsx:534-557` (trocar os dois cards de atalho inline pelo `StatTile` importado)

**Interfaces:**
- Consumes: `cn` de `../../lib/cn`; `Link` de `react-router-dom`.
- Produces: `StatTile({ icon?, label, value, sub?, to?, tone?, delay?, className? }): JSX.Element`. Renderiza como `<Link>` quando `to` é passado (caso do MyDesk), como `<div>` quando não (caso do Stats). `Home.tsx` **não é tocado por esta task** — ver a nota de escopo abaixo.

**Nota de escopo (por que `Home.tsx` fica de fora):** o `ShortcutCard` de `Home.tsx` é um padrão diferente — card de navegação com ícone+título+descrição+chevron, sem valor numérico — enquanto `StatCard` (Stats) e os cards do MyDesk são "métrica com valor grande". Forçar os três num único componente exigiria uma API genérica demais (title+description+chevron OU label+value+sub, ao mesmo tempo) sem ganho real. Além disso, a spec (seção Camada C) já determina que a Home vai deixar de ser uma grade de 9 cards de navegação e virar um dashboard de atenção — investir em consolidar um padrão que está para ser substituído é trabalho perdido. `StatTile` cobre exatamente os dois casos que são genuinamente o mesmo padrão hoje.

- [ ] **Step 1: Criar `apps/web/src/components/ui/StatTile.tsx`**

```tsx
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

interface StatTileProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Se presente, o tile vira um link (react-router). */
  to?: string
  tone?: 'brand' | 'neutral'
  delay?: number
  className?: string
}

/**
 * Card de métrica — rótulo pequeno em maiúsculas + valor grande tabular,
 * com ícone opcional e, opcionalmente, como link. Consolida o que antes
 * eram três implementações quase idênticas (Home, Stats, MyDesk) — Home
 * ficou de fora por ser um padrão diferente (ver plano).
 */
export function StatTile({ icon: Icon, label, value, sub, to, tone = 'brand', delay = 0, className }: StatTileProps) {
  const content = (
    <>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              tone === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-neutral-500/8 text-ink-800',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <p className="text-eyebrow text-neutral-400">{label}</p>
      </div>
      <p className="tabular mt-2.5 text-[26px] font-bold leading-none text-ink-900">
        {value}
        {sub && <span className="ml-1.5 text-[15px] font-normal text-neutral-400">{sub}</span>}
      </p>
    </>
  )

  const classes = cn(
    'animate-fade-in-up rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm',
    'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg',
    to && tone === 'brand' && 'hover:border-brand-200',
    className,
  )

  if (to) {
    return (
      <Link to={to} style={{ animationDelay: `${delay}ms` }} className={cn('group block', classes)}>
        {content}
      </Link>
    )
  }

  return (
    <div style={{ animationDelay: `${delay}ms` }} className={classes}>
      {content}
    </div>
  )
}
```

- [ ] **Step 2: Exportar em `apps/web/src/components/ui/index.ts`**

```ts
export { StatTile } from './StatTile'
```

- [ ] **Step 3: Trocar `StatCard` por `StatTile` em `apps/web/src/pages/Stats.tsx`**

Remover a função `StatCard` inteira (linhas 136-149, mostrada abaixo para localização):
```tsx
function StatCard({ label, value, sub, delay = 0 }: { label: string; value: ReactNode; sub?: ReactNode; delay?: number }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg"
    >
      <p className="text-eyebrow text-neutral-400">{label}</p>
      <p className="tabular mt-2.5 text-[26px] font-bold leading-none text-ink-900">
        {value}
        {sub && <span className="ml-1.5 text-[15px] font-normal text-neutral-400">{sub}</span>}
      </p>
    </div>
  )
}
```

Adicionar `StatTile` ao import de `../components/ui` já existente no topo do arquivo (achar a linha `import { ... } from '../components/ui'` e adicionar `StatTile` à lista).

Trocar **todas as 8 ocorrências** de `<StatCard` por `<StatTile` no arquivo (são chamadas como `<StatCard label="..." value={...} />`, `sub` e `delay` quando presentes continuam funcionando sem alteração — a assinatura de props é um superconjunto compatível). Usar `grep -n "<StatCard" apps/web/src/pages/Stats.tsx` para achar as 8 ocorrências antes e depois da troca, confirmando que a contagem bate.

- [ ] **Step 4: Trocar os dois cards inline de `apps/web/src/pages/MyDesk.tsx:534-557`**

Substituir o bloco (localizado pela `<Link to="/orcamentos"` até o `</Link>` do segundo card, `/pedidos`):
```tsx
<div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
  <Link
    to="/orcamentos"
    className="group rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
  >
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <IconQuote className="h-4 w-4" />
      </span>
      <p className="text-eyebrow text-neutral-400">Meus orçamentos</p>
    </div>
    <p className="tabular mt-3 text-[28px] font-bold leading-none text-ink-900">{myQuotes.length}</p>
  </Link>
  <Link
    to="/pedidos"
    className="group rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
  >
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <IconTruck className="h-4 w-4" />
      </span>
      <p className="text-eyebrow text-neutral-400">Meus pedidos</p>
    </div>
    <p className="tabular mt-3 text-[28px] font-bold leading-none text-ink-900">{myOrders.length}</p>
  </Link>
</div>
```
por:
```tsx
<div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
  <StatTile to="/orcamentos" icon={IconQuote} label="Meus orçamentos" value={myQuotes.length} />
  <StatTile to="/pedidos" icon={IconTruck} label="Meus pedidos" value={myOrders.length} />
</div>
```
Adicionar `StatTile` ao import de `../components/ui` já existente no topo do arquivo. `IconQuote`/`IconTruck` já estão importados (usados pelos cards atuais) — não remover esses imports, `StatTile` ainda os usa via prop `icon`.

Nota: o valor visual muda de `text-[28px]` para `text-[26px]` (o tamanho do `StatTile`/antigo `StatCard`) — normalização deliberada de 2px, não regressão.

- [ ] **Step 5: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 6: Checagem visual manual**

Suba um dev server manual no worktree, abra `/admin/metricas` (Stats) e `/minha-pro-delphus` (MyDesk) logado como admin. Confirme que os cards de métrica continuam com a mesma aparência geral (ícone quando presente, rótulo, valor grande, hover-lift) e que os dois cards do MyDesk ainda navegam para `/orcamentos` e `/pedidos` ao clicar.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/StatTile.tsx apps/web/src/components/ui/index.ts apps/web/src/pages/Stats.tsx apps/web/src/pages/MyDesk.tsx
git commit -m "feat(web): consolidate Stats/MyDesk stat cards into shared StatTile"
```

---

### Task 5: Documentar a convenção de "estado selecionado/ativo"

**Files:**
- Modify: `apps/web/src/components/ui/Controls.tsx:10-13` (comentário acima de `SegmentedControl`)

**Interfaces:** nenhuma — comentário puro, sem mudança de comportamento. `SegmentedControl` (pílula branca elevada), `FilterChip` (preenchimento `bg-ink-900` sólido) e `Badge` (tom suave) continuam com sua aparência atual nesta parte do plano — convergir os três exigiria mudar a aparência de componentes hoje corretos em telas que ainda não foram tocadas pela Camada C, o que é redesign de página, fora de escopo aqui (mesmo raciocínio da Camada A para radius/opacidade: documentar a regra agora, aplicar quando cada arquivo for tocado).

- [ ] **Step 1: Expandir o comentário em `apps/web/src/components/ui/Controls.tsx`**

Substituir (linhas 10-13):
```tsx
/**
 * Controle segmentado no estilo iOS: trilho recuado com a opção ativa
 * “levantada” numa pastilha branca.
 */
```
por:
```tsx
/**
 * Controle segmentado no estilo iOS: trilho recuado com a opção ativa
 * “levantada” numa pastilha branca.
 *
 * Convenção de "estado selecionado/ativo" no app (documentada aqui por ser
 * o primeiro primitivo do arquivo; vale para FilterChip abaixo e para
 * Badge.tsx também):
 *   - Controle de alternância exclusiva num trilho (como este SegmentedControl):
 *     pílula branca elevada sobre o item ativo.
 *   - Filtro booleano solto (como FilterChip abaixo): preenchimento sólido
 *     bg-ink-900 quando ativo.
 *   - Rótulo de status/contagem (Badge, em Feedback.tsx): tom suave da cor
 *     semântica, nunca preenchimento sólido.
 * Três linguagens visuais diferentes de propósito — cada uma sinaliza um
 * tipo de "seleção" distinto (modo exclusivo vs. filtro vs. rótulo
 * informativo). Não unificar visualmente sem necessidade real de produto.
 */
```

- [ ] **Step 2: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
```
(Comentário puro — build deve passar sem qualquer diferença de output.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/Controls.tsx
git commit -m "docs(web): document the three selected/active-state visual conventions"
```

---

### Task 6: Deduplicar os dois chevrons SVG inline

**Files:**
- Modify: `apps/web/src/components/icons.tsx` (adicionar `IconChevronLeft`)
- Modify: `apps/web/src/components/ui/Form.tsx:85-96` (`Select`, usar `IconChevronDown` já existente)
- Modify: `apps/web/src/components/ui/Page.tsx:129-139` (`BackLink`, usar o novo `IconChevronLeft`)

**Interfaces:**
- Consumes: nada externo.
- Produces: `IconChevronLeft` novo em `icons.tsx`, mesmo padrão dos outros ícones do arquivo (usa o `Base` compartilhado).

- [ ] **Step 1: Adicionar `IconChevronLeft` a `apps/web/src/components/icons.tsx`**

Logo depois de `IconChevronRight` (linha 163-169), adicionar:
```tsx
export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m15 18-6-6 6-6" />
    </Base>
  )
}
```
(Mesmo `path` que já está hoje hardcoded dentro de `BackLink` — só está virando um ícone nomeado e reaproveitável.)

- [ ] **Step 2: Simplificar `Select` em `apps/web/src/components/ui/Form.tsx`**

No topo do arquivo, trocar:
```ts
import { cn } from '../../lib/cn'
```
por:
```ts
import { cn } from '../../lib/cn'
import { IconChevronDown } from '../icons'
```

Substituir o bloco do SVG inline (linhas 85-96):
```tsx
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
```
por:
```tsx
      <IconChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
      />
```

- [ ] **Step 3: Simplificar `BackLink` em `apps/web/src/components/ui/Page.tsx`**

No topo do arquivo, trocar:
```ts
import { cn } from '../../lib/cn'
```
por:
```ts
import { cn } from '../../lib/cn'
import { IconChevronLeft } from '../icons'
```

Substituir o bloco do SVG inline (linhas 129-139):
```tsx
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
```
por:
```tsx
      <IconChevronLeft className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
```

- [ ] **Step 4: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 5: Checagem visual manual**

Suba um dev server manual. Abra qualquer tela com um `<Select>` (ex.: filtro de setor em `/produtos`) e confirme o chevron para baixo aparece idêntico a antes. Abra uma tela de detalhe com `<BackLink>` (ex.: `/clientes/:id`) e confirme a seta para a esquerda aparece e anima no hover como antes.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/icons.tsx apps/web/src/components/ui/Form.tsx apps/web/src/components/ui/Page.tsx
git commit -m "refactor(web): dedupe inline chevron SVGs into shared icon components"
```

---

### Task 7: `DropZone` — `cn()` e suporte a teclado

**Files:**
- Modify: `apps/web/src/components/DropZone.tsx` (arquivo inteiro, 55 linhas — reescrever)

**Interfaces:** mesma assinatura de props (`onFiles`, `accept`, `multiple`, `disabled`, `className`, `children`) — nenhum call-site precisa mudar.

- [ ] **Step 1: Reescrever `apps/web/src/components/DropZone.tsx`**

```tsx
import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function DropZone({ onFiles, accept, multiple, disabled, className, children }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFiles(Array.from(fileList))
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (disabled) return
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'cursor-pointer rounded-xl border border-dashed bg-white/60 p-4 text-center transition-[background-color,border-color] duration-150',
        isDragging ? 'border-brand-400 bg-brand-50' : 'border-neutral-300 hover:border-neutral-400 hover:bg-white',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {children}
    </div>
  )
}
```

Mudanças: `cn()` no lugar do template literal cru; `role="button"` + `tabIndex` + `onKeyDown` (Enter/Espaço abrem o seletor de arquivo, igual a um clique) para acessibilidade de teclado; `aria-disabled` quando desabilitado; `className = ''` no default virou `className` opcional simples (o `cn()` já lida com `undefined`).

- [ ] **Step 2: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 3: Checagem visual manual**

Suba um dev server manual, abra uma tela que usa `DropZone` (ex.: upload de mídia em `/produtos`, editar um produto). Confirme: clique abre o seletor de arquivo; arrastar um arquivo sobre a área muda a borda para `brand-400`/fundo `brand-50`; com o foco do teclado na área (Tab até ela), apertar Enter ou Espaço também abre o seletor.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/DropZone.tsx
git commit -m "fix(web): DropZone uses cn() and supports keyboard activation"
```

---

### Task 8: `ConfirmDeleteModal` — usar `Button`/`Input` reais, radius de superfície flutuante, `Button` `danger`

**Files:**
- Modify: `apps/web/src/components/ConfirmDeleteModal.tsx` (arquivo inteiro, 56 linhas — reescrever)

**Interfaces:**
- Consumes: `Button` (Task 2, `variant="danger"` e `isLoading`) e `Input` de `./ui`.
- Produces: mesma assinatura de props (`title`, `description`, `onConfirm`, `onCancel`, `isPending`, `error`) — nenhum call-site precisa mudar.

- [ ] **Step 1: Reescrever `apps/web/src/components/ConfirmDeleteModal.tsx`**

```tsx
import { useState } from 'react'
import { Modal } from './Modal'
import { Button, Input } from './ui'

interface ConfirmDeleteModalProps {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
  error?: string | null
}

const CONFIRM_WORD = 'excluir'

export function ConfirmDeleteModal({ title, description, onConfirm, onCancel, isPending, error }: ConfirmDeleteModalProps) {
  const [value, setValue] = useState('')
  const canConfirm = value.trim().toLowerCase() === CONFIRM_WORD

  return (
    <Modal onClose={onCancel}>
      <div className="animate-scale-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <p className="mt-3 text-sm text-neutral-600">
          Para confirmar, digite <strong className="text-danger-600">excluir</strong> abaixo:
        </p>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) onConfirm()
          }}
          className="mt-2"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={!canConfirm} isLoading={isPending}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

Mudanças: `rounded-xl` → `rounded-3xl` (convenção de radius da Camada A para superfície flutuante); botão/campo hand-rolled → `Button`/`Input` reais (foco, disabled, hover, tudo herda do sistema em vez de reimplementar); cor de erro/ênfase `text-brand-600` → `text-danger-600` (era a mesma cor do CTA primário antes de existir o token de perigo, ver Camada A); "Excluindo…" vira `isLoading` do `Button` (mostra `Spinner` da Task 1 automaticamente).

- [ ] **Step 2: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

- [ ] **Step 3: Checagem visual manual**

Suba um dev server manual, dispare um `ConfirmDeleteModal` real (ex.: excluir um cliente sem orçamentos em `/clientes`, ou excluir uma coluna do quadro no `/minha-pro-delphus`). Confirme: modal com cantos mais arredondados que antes; botão "Excluir" vermelho puro (`danger`, distinto do terracota do resto do app) e desabilitado até digitar "excluir"; durante a exclusão (se conseguir observar o estado pendente), o botão mostra o spinner.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ConfirmDeleteModal.tsx
git commit -m "refactor(web): ConfirmDeleteModal reuses Button/Input, danger token, floating-surface radius"
```

---

## Self-Review Notes

- **Cobertura do spec:** dos itens da seção "Camada B" do spec, este plano cobre: `Button` (danger + isLoading + IconButton), convenção de estado selecionado (documentada), `Alert`, `Combobox`/`Tooltip`/`Toast`/`Tabs` (adiados para o plano B2, dependem de lib nova — decisão já registrada na Architecture acima), `StatTile` (parcial — Home excluída por decisão de escopo justificada), limpeza pontual (`Select`/`BackLink` chevron, `DropZone`, `ConfirmDeleteModal`; consolidação dos shims `Badge.tsx`/`EmptyState.tsx` fica de fora deste plano — é puramente cosmética/organizacional, sem risco, e pode ser feita a qualquer momento independente do resto).
- **Sem placeholders:** cada task tem o código completo a escrever, não descrição vaga.
- **Consistência de tipos:** `StatTile` cobre a superfície de props que `StatCard` (Stats.tsx) e os cards inline do MyDesk já usam hoje — verificado contra o código real de ambos os arquivos antes de escrever este plano, não assumido.
- **Ordem:** Task 1 (Spinner) antes da Task 2 (Button usa Spinner) e antes da Task 8 (ConfirmDeleteModal usa Button.isLoading, que usa Spinner) — dependências respeitadas na ordem de execução.
