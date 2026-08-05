import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatAmount, type OrderDTO, type OrderStatus } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { EmptyState } from '../components/EmptyState'
import { IconTruck } from '../components/icons'

async function fetchOrders() {
  const { data } = await api.get<{ orders: OrderDTO[] }>('/orders')
  return data.orders
}

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
      onClick={() => toggleStatus.mutate(completed ? 'PENDING' : 'COMPLETED')}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 ${
        completed ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {completed ? 'Concluído' : 'Pendente'}
    </button>
  )
}

const monthLabels = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i}>
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="skeleton h-3 w-full max-w-20 rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function Orders() {
  const { user } = useAuth()
  const { data: orders, isLoading, isError } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })

  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)

  const availableYears = useMemo(() => {
    const years = new Set((orders ?? []).map((o) => new Date(o.createdAt).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [orders])

  const filteredOrders = useMemo(() => {
    return (orders ?? []).filter((o) => {
      const date = new Date(o.createdAt)
      if (yearFilter !== 'all' && date.getFullYear() !== Number(yearFilter)) return false
      if (monthFilter !== 'all' && date.getMonth() !== Number(monthFilter)) return false
      if (onlyMine && o.createdBy.id !== user?.id) return false
      return true
    })
  }, [orders, yearFilter, monthFilter, onlyMine, user?.id])

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Pedidos</h1>
          <p className="mt-1 text-neutral-500">
            Gere Invoice, Packing List, Packing List Box e Documento de Exportação a partir de algumas informações.
          </p>
        </div>
        <Link
          to="/pedidos/novo"
          className="mt-7 shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
        >
          + Novo pedido
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:border-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">Todos os anos</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:border-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">Todos os meses</option>
          {monthLabels.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyMine((s) => !s)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            onlyMine
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
          }`}
        >
          Meus pedidos
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Pedido</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Cliente</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Orçamento</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Data</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Criado por</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Total</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading && <SkeletonRows />}
              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-brand-600">
                    Não foi possível carregar os pedidos.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                filteredOrders.map((o, index) => (
                  <tr
                    key={o.id}
                    className="animate-fade-in-up transition-colors hover:bg-neutral-50"
                    style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                  >
                    <td className="px-4 py-2.5">
                      <Link to={`/pedidos/${o.id}`} className="font-medium text-brand-600 hover:underline">
                        #{o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{o.quote.clientName}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{o.quoteNumber}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{o.createdBy.name}</td>
                    <td className="px-4 py-2.5 font-medium text-ink-900">{formatAmount(o.quote.total)}</td>
                    <td className="px-4 py-2.5">
                      <StatusToggle order={o} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/pedidos/novo?duplicateFrom=${o.id}`}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Duplicar
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && filteredOrders.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={IconTruck}
              title="Nenhum pedido encontrado"
              description="Ajuste os filtros ou crie um novo pedido."
            />
          </div>
        )}
      </div>
    </div>
  )
}
