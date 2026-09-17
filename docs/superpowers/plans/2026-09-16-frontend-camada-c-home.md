# Camada C — Home.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a grade de 9 cards de navegação da Home (que duplica 100% a sidebar) por um dashboard real de atenção: o que precisa da ação do usuário hoje (orçamentos parados, pedidos com documento desatualizado, tarefas atrasadas), mais 2 atalhos de ação de verdade (Novo Orçamento, Novo Pedido) com peso visual maior. Dá aos componentes `Alert` (Camada B1) seus primeiros consumidores reais.

**Architecture:** Primeira fatia da Camada C — a mais isolada (só `Home.tsx`), a mais valiosa (resolve a crítica central de "vibe code" do redesign: Home duplicando a sidebar) e a única que não depende de nenhuma outra página ser tocada primeiro. Confirmado por exploração: os três sinais de "atenção" são 100% computáveis hoje com hooks/endpoints já existentes (`GET /quotes`, `GET /orders`, `GET /tasks`, `GET /tasks/board-columns`) — sem trabalho de backend novo. Os fetchers são duplicados localmente em `Home.tsx` (não extraídos para um lib compartilhado) porque essa já é a convenção do código-base: `MyDesk.tsx`, `Quotes.tsx` e `Orders.tsx` cada um já define seu próprio `fetchQuotes`/`fetchOrders` local — não é o escopo desta tarefa introduzir uma abstração nova.

**Tech Stack:** React 19 + TypeScript + `@tanstack/react-query` (já em uso). Nenhuma dependência nova.

**Spec:** [docs/superpowers/specs/2026-09-16-frontend-premium-redesign-design.md](../specs/2026-09-16-frontend-premium-redesign-design.md) — seção Camada C, item Home.tsx.

## Global Constraints

- Branch de trabalho nasce da ponta atual de `feature/frontend-design-tokens` (já com Camadas A, B1 e B2 mergeadas).
- Sem framework de teste automatizado. Verificação = `npm run build --workspace=apps/web` + `npm run lint --workspace=apps/web` + checagem visual manual via dev server **rodado manualmente de dentro do worktree** (nunca `preview_start {name:"web"}` — root errado neste ambiente).
- Os três sinais de atenção são escopados ao usuário logado (`quote.createdBy.id === user.id`, `order.createdBy.id === user.id`; tarefas já vêm só do usuário pelo backend) — mesma convenção pessoal que `MyDesk.tsx` já usa para `myQuotes`/`myOrders`.
- As `queryKey`s usadas (`['quotes']`, `['orders']`, `['tasks']`, `['board-columns']`) devem ser exatamente as mesmas strings já usadas em `Quotes.tsx`/`Orders.tsx`/`MyDesk.tsx`, para compartilhar cache do react-query em vez de recalcular em paralelo.
- Não tocar em nenhum outro arquivo além de `apps/web/src/pages/Home.tsx`.

---

### Task 1: Reescrever `Home.tsx` como dashboard de atenção

**Files:**
- Modify: `apps/web/src/pages/Home.tsx` (arquivo inteiro — reescrever)

**Interfaces:**
- Consumes: `Alert`, `ButtonLink`, `Page`, `Skeleton` de `../components/ui`; `IconPlus` de `../components/icons`; `useAuth` de `../context/AuthContext`; `api` de `../lib/api`; `QuoteDTO`, `OrderDTO`, `PersonalTaskDTO`, `PersonalBoardColumnDTO` de `@prodelphusplus/shared`.
- Produces: nenhuma interface nova exportada — `Home` continua o único export do arquivo, mesma assinatura (`export function Home()`), sem props.

- [ ] **Step 1: Reescrever `apps/web/src/pages/Home.tsx`**

Conteúdo completo:

```tsx
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OrderDTO, PersonalBoardColumnDTO, PersonalTaskDTO, QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Alert, ButtonLink, Page, Skeleton } from '../components/ui'
import { IconBot, IconPlus } from '../components/icons'

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

async function fetchOrders() {
  const { data } = await api.get<{ orders: OrderDTO[] }>('/orders')
  return data.orders
}

async function fetchTasks() {
  const { data } = await api.get<{ tasks: PersonalTaskDTO[] }>('/tasks')
  return data.tasks
}

async function fetchColumns() {
  const { data } = await api.get<{ columns: PersonalBoardColumnDTO[] }>('/tasks/board-columns')
  return data.columns
}

// Tarefa num quadro marcado como "concluído" nunca conta como atrasada — mesma
// regra que Minha Pro Delphus já usa.
function isOverdue(dueDate: string | null, isDone: boolean) {
  if (!dueDate || isDone) return false
  return new Date(dueDate).getTime() < Date.now()
}

/** Orçamento sem pedido gerado depois desse tanto de dias entra no painel de atenção. */
const STALE_QUOTE_DAYS = 5

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function Home() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] ?? ''

  const { data: quotes, isLoading: loadingQuotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: orders, isLoading: loadingOrders } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })
  const { data: tasks, isLoading: loadingTasks } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks })
  const { data: columns, isLoading: loadingColumns } = useQuery({
    queryKey: ['board-columns'],
    queryFn: fetchColumns,
  })

  const isLoading = loadingQuotes || loadingOrders || loadingTasks || loadingColumns

  const staleQuotesCount = useMemo(() => {
    if (!quotes || !orders || !user) return 0
    const orderedQuoteIds = new Set(orders.map((o) => o.quoteId))
    const cutoff = Date.now() - STALE_QUOTE_DAYS * 24 * 60 * 60 * 1000
    return quotes.filter(
      (q) => q.createdBy.id === user.id && !orderedQuoteIds.has(q.id) && new Date(q.createdAt).getTime() < cutoff,
    ).length
  }, [quotes, orders, user])

  const staleOrdersCount = useMemo(() => {
    if (!orders || !user) return 0
    return orders.filter((o) => o.createdBy.id === user.id && o.documentsStale).length
  }, [orders, user])

  const overdueTasksCount = useMemo(() => {
    if (!tasks || !columns) return 0
    const doneColumnIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id))
    return tasks.filter((t) => isOverdue(t.dueDate, doneColumnIds.has(t.columnId))).length
  }, [tasks, columns])

  const hasAttention = staleQuotesCount > 0 || staleOrdersCount > 0 || overdueTasksCount > 0

  return (
    <Page
      title={`${greeting()}, ${firstName}.`}
      description="O que você deseja fazer hoje?"
      actions={
        <ButtonLink size="sm" to="/neo">
          <IconBot className="h-4 w-4" />
          NEO
        </ButtonLink>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {staleQuotesCount > 0 && (
            <Alert
              tone="warning"
              action={
                <ButtonLink to="/orcamentos" size="sm" variant="ghost">
                  Ver orçamentos
                </ButtonLink>
              }
            >
              {staleQuotesCount === 1
                ? '1 orçamento seu está parado há mais de 5 dias, sem pedido gerado.'
                : `${staleQuotesCount} orçamentos seus estão parados há mais de 5 dias, sem pedido gerado.`}
            </Alert>
          )}
          {staleOrdersCount > 0 && (
            <Alert
              tone="warning"
              action={
                <ButtonLink to="/pedidos" size="sm" variant="ghost">
                  Ver pedidos
                </ButtonLink>
              }
            >
              {staleOrdersCount === 1
                ? '1 pedido seu está com os documentos desatualizados.'
                : `${staleOrdersCount} pedidos seus estão com os documentos desatualizados.`}
            </Alert>
          )}
          {overdueTasksCount > 0 && (
            <Alert
              tone="warning"
              action={
                <ButtonLink to="/minha-pro-delphus" size="sm" variant="ghost">
                  Ver quadro
                </ButtonLink>
              }
            >
              {overdueTasksCount === 1
                ? '1 tarefa sua está atrasada no quadro pessoal.'
                : `${overdueTasksCount} tarefas suas estão atrasadas no quadro pessoal.`}
            </Alert>
          )}
          {!hasAttention && (
            <Alert tone="success">
              Tudo em dia — nenhum orçamento parado, pedido com documento desatualizado ou tarefa atrasada.
            </Alert>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/orcamentos/novo" variant="primary" size="lg">
          <IconPlus className="h-4 w-4" />
          Novo Orçamento
        </ButtonLink>
        <ButtonLink to="/pedidos/novo" variant="primary" size="lg">
          <IconPlus className="h-4 w-4" />
          Novo Pedido
        </ButtonLink>
      </div>
    </Page>
  )
}
```

Mudanças em relação ao arquivo atual: removidos `ShortcutCard`, os arrays `shortcuts`/`adminShortcuts`, a `Section` de Administração, `Link`, `cn` e os ícones de navegação (`IconBoard`, `IconBox`, `IconChart`, `IconChevronRight`, `IconContacts`, `IconLayers`, `IconQuote`, `IconTag`, `IconTruck`, `IconUsers`) — nenhum é mais usado, já que a Home para de duplicar a sidebar. `IconBot` continua (botão NEO no header, inalterado). O `user?.role === 'ADMIN'` check saiu inteiro — os três sinais de atenção e os dois atalhos de ação são iguais para todo usuário; a navegação de administração já está sempre visível na sidebar para quem é admin.

- [ ] **Step 2: Verificar**

```bash
npm run build --workspace=packages/shared && npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```
Ambos devem passar sem erro novo (o TypeScript vai reclamar se algum import ficou sem uso, ou se algum import necessário faltou).

- [ ] **Step 3: Checagem visual manual**

Suba um dev server **manual** de dentro do worktree (`cd apps/web && npx vite --port <livre> --strictPort` — nunca `preview_start {name:"web"}`). Como isso agora depende de dados reais (orçamentos/pedidos/tarefas do usuário logado), a checagem completa exige a API e o Postgres de pé (`npm run db:up` e `npm run dev:api` a partir da raiz do monorepo, se ainda não estiverem rodando) e login com uma conta real. Confirme:
- A tela carrega sem erro no console, mostra o skeleton brevemente e depois o conteúdo real.
- Se a conta de teste não tiver nenhum orçamento parado/pedido desatualizado/tarefa atrasada, aparece o `Alert` verde "Tudo em dia...".
- Se conseguir gerar uma condição de atenção real (ex.: criar um orçamento e não gerar pedido, esperar não é viável — em vez disso, pode inspecionar via `read_network_requests`/DOM que a contagem bate com os dados reais retornados por `/quotes` e `/orders` para esse usuário, comparando manualmente), confirme que o `Alert` amarelo aparece com a contagem certa e o link de ação leva para a página certa.
- Os dois botões "Novo Orçamento" e "Novo Pedido" navegam para `/orcamentos/novo` e `/pedidos/novo`.
- O botão NEO no cabeçalho continua funcionando como antes.
- Confirme que a grade de 9 cards antiga **não aparece mais** em lugar nenhum da tela.

Se subir a API completa for inviável no ambiente do agente, documentar exatamente isso no relatório (build/lint passando é a verificação mínima aceitável; o ideal é complementar com o máximo de checagem via rede/DOM que der, mesmo sem interface visual renderizada por completo) — não inventar uma observação que não foi feita.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Home.tsx
git commit -m "feat(web): replace Home's nav-duplicating card grid with a real attention dashboard"
```

---

## Self-Review Notes

- Cobertura do spec: item único "Home.tsx" da Camada C — coberto integralmente (remove a grade de 9 cards, adiciona painel de atenção com dados reais, adiciona 2 atalhos de ação com peso visual maior, reaproveita `Alert` da Camada B1 como primeiro consumidor real — recomendação explícita da revisão final da B1).
- Sem placeholders: código completo do arquivo, decisão de threshold (5 dias) explícita e documentada.
- Risco identificado e mitigado: a página passa de estática para dependente de rede/autenticação — por isso o Step 3 já antecipa que a checagem visual completa exige API+DB de pé, e dá uma saída honesta (verificação via rede/DOM, documentar limitação) caso não seja viável no ambiente do executor.
