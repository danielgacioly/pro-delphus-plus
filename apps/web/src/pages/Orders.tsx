import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { OrderDTO, OrderStatus } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

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
    <label className="flex items-center gap-1.5 text-xs text-neutral-600">
      <input
        type="checkbox"
        checked={completed}
        disabled={toggleStatus.isPending}
        onChange={(e) => toggleStatus.mutate(e.target.checked ? 'COMPLETED' : 'PENDING')}
      />
      <span className={completed ? 'font-medium text-green-700' : 'font-medium text-amber-700'}>
        {completed ? 'Concluído' : 'Pendente'}
      </span>
    </label>
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
          className="mt-7 shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Novo pedido
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
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
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Todos os meses</option>
          {monthLabels.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Meus pedidos
        </label>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Pedido</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Cliente</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Orçamento</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Data</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Criado por</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Total</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-neutral-400">
                  Carregando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-brand-600">
                  Não foi possível carregar os pedidos.
                </td>
              </tr>
            )}
            {!isLoading && !isError && filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-neutral-400">
                  Nenhum pedido encontrado para o filtro selecionado.
                </td>
              </tr>
            )}
            {filteredOrders.map((o) => (
              <tr key={o.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link to={`/pedidos/${o.id}`} className="font-medium text-brand-600 hover:underline">
                    #{o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">{o.quote.clientName}</td>
                <td className="px-4 py-2 text-neutral-500">{o.quoteNumber}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2 text-neutral-500">{o.createdBy.name}</td>
                <td className="px-4 py-2 text-ink-900">{Number(o.quote.total).toFixed(2)}</td>
                <td className="px-4 py-2">
                  <StatusToggle order={o} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
