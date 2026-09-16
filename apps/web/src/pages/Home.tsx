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
