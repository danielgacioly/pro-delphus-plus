import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { formatAmount, formatOrderNumber, type OrderDTO, type OrderStatus } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import {
  ButtonLink,
  EmptyState,
  Page,
  SearchField,
  SegmentedControl,
  Select,
  SkeletonRows,
  TBody,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Toolbar,
  Tr,
} from '../components/ui'
import { IconPlus, IconTruck } from '../components/icons'

async function fetchOrders() {
  const { data } = await api.get<{ orders: OrderDTO[] }>('/orders')
  return data.orders
}

/** Status é uma alternância direta: um clique, sem menu intermediário. */
function StatusToggle({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient()
  const toggleStatus = useMutation({
    mutationFn: async (status: OrderStatus) => {
      const { data } = await api.patch<{ order: OrderDTO }>(`/orders/${order.id}/status`, { status })
      return data.order
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<OrderDTO[]>(['orders'], (prev) =>
        prev?.map((o) => (o.id === updated.id ? updated : o)),
      )
    },
  })

  const completed = order.status === 'COMPLETED'

  return (
    <button
      type="button"
      disabled={toggleStatus.isPending}
      onClick={(e) => {
        // A linha inteira navega para o pedido — alternar status não deve sair da lista.
        e.stopPropagation()
        toggleStatus.mutate(completed ? 'PENDING' : 'COMPLETED')
      }}
      title={completed ? 'Marcar como pendente' : 'Marcar como concluído'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium',
        'transition-[background-color,transform] duration-150 ease-out active:scale-95 disabled:opacity-50',
        completed
          ? 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20'
          : 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', completed ? 'bg-emerald-500' : 'bg-amber-500')} />
      {completed ? 'Concluído' : 'Pendente'}
    </button>
  )
}

const COLUMNS = 7

export function Orders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: orders, isLoading, isError } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })

  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [status, setStatus] = useState<'all' | 'PENDING' | 'COMPLETED'>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [search, setSearch] = useState('')

  const availableYears = useMemo(() => {
    const years = new Set((orders ?? []).map((o) => new Date(o.createdAt).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [orders])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (orders ?? []).filter((o) => {
      const date = new Date(o.createdAt)
      if (yearFilter !== 'all' && date.getFullYear() !== Number(yearFilter)) return false
      if (scope === 'mine' && o.createdBy.id !== user?.id) return false
      if (status !== 'all' && o.status !== status) return false
      if (term && !`${o.orderNumber} ${o.quote.clientName} ${o.quoteNumber}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [orders, yearFilter, scope, status, user?.id, search])

  return (
    <Page
      title="Pedidos"
      description="Gere Invoice, Packing List e o documento de exportação a partir de um orçamento existente."
      actions={
        <ButtonLink to="/pedidos/novo" variant="primary" size="sm">
          <IconPlus className="h-4 w-4" />
          Novo pedido
        </ButtonLink>
      }
    >
      <Toolbar className="mb-4">
        <SegmentedControl
          aria-label="Escopo"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'mine', label: 'Meus' },
          ]}
        />
        <SegmentedControl
          aria-label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Qualquer status' },
            { value: 'PENDING', label: 'Pendentes' },
            { value: 'COMPLETED', label: 'Concluídos' },
          ]}
        />
        <Select
          aria-label="Ano"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          auto
          className="h-9 text-[13px]"
        >
          <option value="all">Todos os anos</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por pedido ou cliente"
          className="ml-auto w-full sm:w-72"
        />
      </Toolbar>

      <TableShell>
        <Table>
          <THead>
            <tr>
              <Th>Pedido</Th>
              <Th>Cliente</Th>
              <Th>Data</Th>
              <Th>Criado por</Th>
              <Th align="right">Total</Th>
              <Th>Status</Th>
              <Th align="right">Ações</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading && <SkeletonRows rows={6} columns={COLUMNS} />}

            {isError && (
              <tr>
                <td colSpan={COLUMNS} className="px-4 py-6 text-center text-sm text-brand-600">
                  Não foi possível carregar os pedidos.
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              filteredOrders.map((o) => (
                <Tr key={o.id} interactive onClick={() => navigate(`/pedidos/${o.id}`)}>
                  <Td>
                    {/* Continua sendo link para permitir abrir em nova aba (cmd/ctrl+clique). */}
                    <Link
                      to={`/pedidos/${o.id}`}
                      className="tabular font-semibold text-ink-900 transition-colors hover:text-brand-600"
                    >
                      #{formatOrderNumber(o.orderNumber)}
                    </Link>
                  </Td>
                  <Td className="max-w-88">
                    <p className="truncate font-medium text-ink-900">{o.quote.clientName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-500">Orç. {o.quoteNumber}</p>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-neutral-500">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                  </Td>
                  <Td className="whitespace-nowrap text-neutral-500">{o.createdBy.name}</Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink-900">
                    {formatAmount(o.quote.total)}
                  </Td>
                  <Td>
                    <StatusToggle order={o} />
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/pedidos/novo?duplicateFrom=${o.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-7 items-center rounded-md border border-neutral-200 bg-white px-2 text-[12px] font-semibold text-neutral-600 shadow-xs transition-[background-color,border-color,color,transform] duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:text-ink-900 active:scale-95"
                    >
                      Duplicar
                    </Link>
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>

        {!isLoading && !isError && filteredOrders.length === 0 && (
          <EmptyState
            icon={IconTruck}
            title="Nenhum pedido encontrado"
            description="Ajuste os filtros ou crie um novo pedido."
            action={
              <ButtonLink to="/pedidos/novo" variant="secondary" size="sm">
                Novo pedido
              </ButtonLink>
            }
          />
        )}
      </TableShell>
    </Page>
  )
}
