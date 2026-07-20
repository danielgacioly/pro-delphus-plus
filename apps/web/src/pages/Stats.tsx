import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../lib/api'

interface MonthStat {
  year: number
  month: number
  count: number
  totalUSD: number
  totalBRL: number
}

interface YearStat {
  year: number
  count: number
  totalUSD: number
  totalBRL: number
}

interface ProductStat {
  productName: string
  quantity: number
  revenueUSD: number
  revenueBRL: number
}

interface SectorStat {
  sector: string
  salesCount: number
}

interface StatsResponse {
  totalOrders: number
  totalByCurrency: { USD: number; BRL: number }
  statusBreakdown: { PENDING: number; COMPLETED: number }
  byMonth: MonthStat[]
  byYear: YearStat[]
  topProducts: ProductStat[]
  sectorsSold: SectorStat[]
}

async function fetchStats() {
  const { data } = await api.get<StatsResponse>('/stats')
  return data
}

const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmt(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const STATUS_COLORS = { PENDING: '#00000', COMPLETED: '#dc2626' }

export function Stats() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })

  if (isLoading) return <p className="text-neutral-400">Carregando…</p>
  if (isError || !data) return <p className="text-brand-600">Não foi possível carregar as métricas.</p>

  const monthChartData = data.byMonth.map((m) => ({
    label: `${monthLabels[m.month - 1]}/${String(m.year).slice(2)}`,
    USD: Number(m.totalUSD.toFixed(2)),
    BRL: Number(m.totalBRL.toFixed(2)),
    Pedidos: m.count,
  }))

  const yearChartData = data.byYear.map((y) => ({
    label: String(y.year),
    USD: Number(y.totalUSD.toFixed(2)),
    BRL: Number(y.totalBRL.toFixed(2)),
    Pedidos: y.count,
  }))

  const statusChartData = [
    { name: 'Pendente', value: data.statusBreakdown.PENDING, key: 'PENDING' as const },
    { name: 'Concluído', value: data.statusBreakdown.COMPLETED, key: 'COMPLETED' as const },
  ]

  const productChartData = data.topProducts.map((p) => ({
    label: p.productName.length > 28 ? `${p.productName.slice(0, 28)}…` : p.productName,
    Quantidade: p.quantity,
  }))

  const sectorChartData = data.sectorsSold.map((s) => ({
    label: s.sector,
    Vendas: s.salesCount,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Métricas</h1>
      <p className="mt-1 text-neutral-500">Vendas por período, status dos pedidos e produtos mais vendidos.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Pedidos totais</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{data.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Vendido (USD)</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">$ {fmt(data.totalByCurrency.USD)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Vendido (BRL)</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">R$ {fmt(data.totalByCurrency.BRL)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Concluídos</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {data.statusBreakdown.COMPLETED}
            <span className="ml-1 text-sm font-normal text-neutral-400">/ {data.totalOrders}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Vendas por mês</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="USD" stroke="#ef1818" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="BRL" stroke="#1a1a1a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Status dos pedidos</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {statusChartData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Vendas por ano</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="USD" fill="#ef1818" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BRL" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Produtos mais vendidos (por quantidade)</h2>
          {productChartData.length === 0 ? (
            <p className="text-sm text-neutral-400">Sem dados suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={productChartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="label" type="category" fontSize={10} width={160} />
                <Tooltip />
                <Bar dataKey="Quantidade" fill="#ef1818" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Áreas vendidas (nº de vendas por setor)</h2>
          <p className="mb-3 text-xs text-neutral-400">
            Conta pedidos que tiveram pelo menos um item do setor — não a quantidade de produtos. Um pedido com
            itens de Breast e Thoracic conta uma vez para cada setor.
          </p>
          {sectorChartData.length === 0 ? (
            <p className="text-sm text-neutral-400">Sem dados suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, sectorChartData.length * 32)}>
              <BarChart data={sectorChartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="label" type="category" fontSize={10} width={160} />
                <Tooltip />
                <Bar dataKey="Vendas" fill="#1a1a1a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
