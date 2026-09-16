# Fundação de Design Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consertar a fundação de tokens do front-end (`index.css` e o helper `cn()`) — cor de erro/perigo dedicada, convenção documentada de border-radius e de opacidade, e resolução de conflito de classes Tailwind — para que a Camada B (biblioteca de componentes compartilhados) e a Camada C (páginas) tenham uma base única e sem ambiguidade para consumir.

**Architecture:** Este é o primeiro de uma série de planos que implementam o spec de repaginada de front-end. Ele toca **apenas** `apps/web/src/index.css` e `apps/web/src/lib/cn.ts` — nenhum componente visual muda de aparência como resultado direto deste plano (a nova rampa de cor e as convenções documentadas só passam a ser *usadas* nos planos seguintes, que tratam a Camada B). O único ponto com risco real de regressão visual é a reescrita de `cn()` para usar `tailwind-merge`, por ser consumida por todo componente do app.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 (`@theme` em CSS), Vite. Novas dependências: `clsx` e `tailwind-merge`.

**Spec:** [docs/superpowers/specs/2026-09-16-frontend-premium-redesign-design.md](../specs/2026-09-16-frontend-premium-redesign-design.md) — seção "Camada A — Fundação de tokens".

## Global Constraints

- O projeto não tem framework de teste automatizado (`apps/web/package.json` só define `dev`, `build`, `lint`, `preview`). A verificação de cada tarefa usa `npm run build --workspace=apps/web` (typecheck via `tsc -b` + build via `vite build`) e `npm run lint --workspace=apps/web` (oxlint) como critério de "passou", mais checagem visual manual via o dev server — não introduzir Vitest/Jest como pré-requisito não solicitado.
- Não alterar nenhum arquivo fora de `apps/web/src/index.css`, `apps/web/src/lib/cn.ts` e `apps/web/package.json` (para as novas dependências) neste plano.
- Manter `color-scheme: light` — o projeto não suporta dark mode hoje; nenhuma tarefa deste plano deve introduzir suporte a dark mode.
- Todos os valores de cor novos devem ser adicionados dentro do bloco `@theme` existente em `index.css`, seguindo o formato `--color-<nome>-<step>: #hex;` já usado pelas rampas `brand`/`ink`/`neutral`.

---

### Task 1: `cn()` com resolução de conflito de classes (`clsx` + `tailwind-merge`)

**Files:**
- Modify: `apps/web/package.json` (nova dependência)
- Modify: `apps/web/src/lib/cn.ts:1-6`

**Interfaces:**
- Consumes: nada (é a base do app).
- Produces: `cn(...values: ClassValue[]): string` — mesma assinatura pública de hoje (aceita strings e valores falsy variádicos), então nenhum call-site (`Button.tsx`, `Card.tsx`, etc.) precisa mudar. `ClassValue` passa a ser reexportado do tipo `ClassValue` de `clsx` em vez do tipo local `string | false | null | undefined`, que é um superconjunto compatível (também aceita arrays e objetos, o que nenhum call-site usa hoje, mas não quebra nada).

- [ ] **Step 1: Instalar as dependências**

Rodar a partir da raiz do monorepo:

```bash
npm install clsx tailwind-merge --workspace=apps/web
```

Isso adiciona `clsx` e `tailwind-merge` em `apps/web/package.json` → `dependencies`.

- [ ] **Step 2: Reescrever `apps/web/src/lib/cn.ts`**

Conteúdo completo do arquivo (substitui as 6 linhas atuais):

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type { ClassValue }

/** Junta classes ignorando valores falsy e resolvendo conflitos Tailwind (a última classe de uma mesma propriedade vence). */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values))
}
```

- [ ] **Step 3: Rodar o build para confirmar que nada quebrou**

```bash
npm run build --workspace=apps/web
```

Esperado: build conclui sem erro de tipo (todo call-site de `cn(...)` já passa strings/falsy, compatíveis com `ClassValue` de `clsx`).

- [ ] **Step 4: Rodar o lint**

```bash
npm run lint --workspace=apps/web
```

Esperado: sem novos erros.

- [ ] **Step 5: Verificação visual manual**

Subir o app (`npm run db:up`, `npm run dev:api`, `npm run dev:web` a partir da raiz) e abrir pelo menos três telas que usam bastante composição de classes condicionais — `/` (Home, usa `cn` em `ShortcutCard`), `/precos` (PriceTable, toolbar com `SegmentedControl`/`FilterChip`) e `/minha-pro-delphus` (MyDesk, estados de coluna/drag). Confirmar visualmente que nada mudou de aparência (cores, bordas, hover) comparado ao comportamento antes da mudança. `tailwind-merge` só passa a produzir um resultado diferente de antes quando duas classes do mesmo grupo (ex.: duas classes `rounded-*` ou duas `bg-*`) chegam concatenadas — hoje isso não acontece em nenhum call-site (cada componente já evita esse conflito manualmente, como o `widthClass()` de `Form.tsx`), então o resultado deve ser visualmente idêntico.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/lib/cn.ts
git commit -m "feat(web): resolve tailwind class conflicts in cn() via tailwind-merge"
```

---

### Task 2: Rampa de cor semântica `danger`

**Files:**
- Modify: `apps/web/src/index.css:1-15` (dentro do bloco `@theme`, logo após a rampa `--color-brand-*`)

**Interfaces:**
- Consumes: nenhum.
- Produces: custom properties `--color-danger-50` até `--color-danger-900`, que o Tailwind v4 expõe automaticamente como utilities `bg-danger-*`, `text-danger-*`, `border-danger-*`, `ring-danger-*` etc. (mesmo mecanismo que já expõe `bg-brand-600` hoje a partir de `--color-brand-600`). Essas utilities serão consumidas pelo plano da Camada B (correção do `Button` `danger`, texto de erro em `Form`, novo componente `Alert`).

- [ ] **Step 1: Adicionar a rampa ao `@theme` de `apps/web/src/index.css`**

Localizar o bloco `/* ---- Brand -------------------------------------------------------- */` (linhas 4-14) e adicionar, logo depois dele (antes do comentário `/* ---- Ink (warm near-blacks) --------------------------------------- */`):

```css
  /* ---- Danger (dedicated red — distinct hue from the warm brand ramp) --- */
  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-200: #fecaca;
  --color-danger-300: #fca5a5;
  --color-danger-400: #f87171;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;
  --color-danger-700: #b91c1c;
  --color-danger-800: #991b1b;
  --color-danger-900: #7f1d1d;
```

Esta é uma rampa de vermelho puro (mais fria/saturada que o `brand`, que é terracota). A escolha deliberada é para que "erro/perigo" nunca seja visualmente confundível com a cor de ação primária do produto — hoje `Button` `danger` é idêntico a `primary` (`apps/web/src/components/ui/Button.tsx:14,18`) exatamente por não existir essa rampa.

- [ ] **Step 2: Rodar o build para confirmar que o CSS é válido**

```bash
npm run build --workspace=apps/web
```

Esperado: build conclui sem erro (Tailwind v4 gera as utilities `danger-*` automaticamente a partir do `@theme`; não há erro de tipo TypeScript possível aqui pois é CSS puro).

- [ ] **Step 3: Verificação visual manual da rampa**

Criar temporariamente uma linha em qualquer página já aberta no dev server (ex.: colar `<div className="flex gap-2">{['50','100','200','300','400','500','600','700','800','900'].map(s => <div key={s} className={`h-10 w-10 bg-danger-${s}`} />)}</div>` dentro do JSX de `Home.tsx`) para conferir visualmente que a rampa renderiza como uma progressão de vermelho coerente e distinta do `brand` (que aparece ao lado em `ShortcutCard`). Remover esse trecho de teste antes do commit — não faz parte do código final.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(web): add dedicated danger color ramp to design tokens"
```

---

### Task 3: Documentar a convenção de border-radius por nível de superfície

**Files:**
- Modify: `apps/web/src/index.css:49-55` (bloco `/* ---- Radii ... ---- */`)

**Interfaces:**
- Consumes: a escala `--radius-sm` (0.375rem) até `--radius-3xl` (1.5rem), já existente.
- Produces: nenhuma nova custom property — só um comentário normativo que os planos seguintes (Camada B/C) devem seguir ao escolher qual classe `rounded-*` usar em cada componente. Registrado aqui como documentação executável (é o arquivo que qualquer implementador vai abrir antes de escolher um raio).

- [ ] **Step 1: Expandir o comentário do bloco de radii em `apps/web/src/index.css`**

Substituir:

```css
  /* ---- Radii — generous, closer to Apple's continuous corners -------- */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.625rem;
  --radius-xl: 0.875rem;
  --radius-2xl: 1.125rem;
  --radius-3xl: 1.5rem;
```

por:

```css
  /* ---- Radii — generous, closer to Apple's continuous corners --------
     Convenção por nível de superfície (não escolher um rounded-* por
     preferência pontual — seguir esta tabela):
       - Controles inline (button, input, select, chip, segmented item,
         ícone de ação): rounded-lg
       - Containers de conteúdo (card, tabela, painel de seção): rounded-2xl
       - Superfícies flutuantes (modal, popover, dropdown, toast): rounded-3xl
     Hoje só o SegmentedControl (rounded-[7px], em Controls.tsx) e as
     superfícies flutuantes (rounded-xl em Modal/DropZone/ConfirmDeleteModal)
     divergem desta tabela — corrigido na Camada B. */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.625rem;
  --radius-xl: 0.875rem;
  --radius-2xl: 1.125rem;
  --radius-3xl: 1.5rem;
```

- [ ] **Step 2: Rodar o build para confirmar que o CSS continua válido**

```bash
npm run build --workspace=apps/web
```

Esperado: build conclui sem erro (mudança é só um comentário CSS, sem efeito funcional).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "docs(web): document border-radius convention by surface tier"
```

---

### Task 4: Documentar a convenção de opacidade para estados de interação

**Files:**
- Modify: `apps/web/src/index.css` (novo comentário, logo após o bloco de radii adicionado na Task 3, antes do bloco `/* ---- Motion ... ---- */`)

**Interfaces:**
- Consumes: nenhum.
- Produces: nenhuma nova custom property (Tailwind v4 já resolve `bg-neutral-500/8` etc. via modificador de opacidade nativo — não precisa de token separado). Produz apenas a tabela normativa que a Camada B/C deve seguir.

- [ ] **Step 1: Adicionar o comentário de convenção de opacidade em `apps/web/src/index.css`**

Logo antes de `/* ---- Motion --------------------------------------------------------- */`, adicionar:

```css
  /* ---- Opacity convention for interactive states ----------------------
     Usar sempre um destes quatro valores como modificador de opacidade
     Tailwind (ex.: bg-neutral-500/6) em vez de um número arbitrário:
       - /6   hover sutil (linha de tabela, item de lista)
       - /10  hover de destaque / fundo de badge neutro
       - /14  estado selecionado ou ativo (fundo sólido leve)
       - /25  overlay/scrim (fundo de modal, backdrop)
     Hoje há usos soltos de /4, /8, /12, /15 sem critério — corrigidos
     conforme cada arquivo for tocado na Camada B/C. */
```

- [ ] **Step 2: Rodar o build para confirmar que o CSS continua válido**

```bash
npm run build --workspace=apps/web
```

Esperado: build conclui sem erro.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "docs(web): document opacity convention for interactive states"
```

---

## Self-Review Notes

- **Cobertura do spec**: os quatro itens da seção "Camada A" do spec (`lib/cn.ts`, cor de erro/perigo, convenção de radius, convenção de opacidade) têm cada um uma task correspondente (Tasks 1-4). Nenhum item da Camada A ficou sem task.
- **Sem placeholders**: cada task tem o diff/conteúdo exato a aplicar, não descrições vagas.
- **Consistência de tipos**: `cn()` mantém a mesma assinatura pública usada em todos os ~20 call-sites existentes (`Button.tsx`, `Card.tsx`, `Controls.tsx`, `Page.tsx`, etc.) — nenhum desses arquivos precisa de alteração neste plano.
- **Fora de escopo, de propósito**: aplicar a nova cor `danger` no `Button`, migrar `SegmentedControl`/`Modal`/`DropZone` para a convenção de radius documentada, e migrar opacidades ad hoc para a escala nomeada são trabalho da Camada B (próximo plano) — este plano só constrói a fundação que esses planos vão consumir.
