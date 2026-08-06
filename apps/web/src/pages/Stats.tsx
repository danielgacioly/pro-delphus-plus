import type { ReactNode } from 'react'
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
import { Card, Page, Skeleton } from '../components/ui'

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

const BRAND = '#cd2b1d'
const INK = '#33313a'
const GRID = '#e8e6e3'
const STATUS_COLORS = { PENDING: '#f59e0b', COMPLETED: BRAND }

const axisProps = {
  fontSize: 11,
  stroke: '#8a8580',
  tickLine: false,
  axisLine: false,
} as const

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e8e6e3',
    boxShadow: '0 14px 36px rgb(23 22 26 / 0.09)',
    fontSize: 12,
  },
} as const

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

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="px-5 pt-5">
        <h2 className="text-heading text-ink-900">{title}</h2>
        {description && <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">{description}</p>}
      </div>
      <div className="px-2 pb-4 pt-4">{children}</div>
    </Card>
  )
}

function StatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm lg:col-span-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-64 rounded-xl" />
        </div>
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-64 rounded-xl" />
        </div>
      </div>
    </>
  )
}

export function Stats() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })

  const page = (children: ReactNode) => (
    <Page title="Métricas" description="Vendas por período, status dos pedidos e produtos mais vendidos.">
      {children}
    </Page>
  )

  if (isLoading) return page(<StatsSkeleton />)

  if (isError || !data) {
    return page(
      <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
        Não foi possível carregar as métricas.
      </div>,
    )
  }

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

  const sectorChartData = data.sectorsSold.map((s) => ({ label: s.sector, Vendas: s.salesCount }))

  return page(
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pedidos totais" value={data.totalOrders} />
        <StatCard label="Vendido (USD)" value={`$ ${fmt(data.totalByCurrency.USD)}`} delay={40} />
        <StatCard label="Vendido (BRL)" value={`R$ ${fmt(data.totalByCurrency.BRL)}`} delay={80} />
        <StatCard
          label="Concluídos"
          value={data.statusBreakdown.COMPLETED}
          sub={`/ ${data.totalOrders}`}
          delay={120}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Vendas por mês" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="USD" stroke={BRAND} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="BRL" stroke={INK} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status dos pedidos">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              {/* isAnimationActive={false}: a animação de entrada do recharts não
                  conclui aqui e deixava as fatias com ângulo zero (gráfico vazio). */}
              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={92}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {statusChartData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Vendas por ano">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgb(23 22 26 / 0.04)' }} />
              <Bar dataKey="USD" fill={BRAND} radius={[6, 6, 0, 0]} />
              <Bar dataKey="BRL" fill={INK} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Produtos mais vendidos" description="Por quantidade de unidades.">
          {productChartData.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-neutral-400">Sem dados suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={productChartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="label" type="category" {...axisProps} fontSize={10} width={160} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgb(23 22 26 / 0.04)' }} />
                <Bar dataKey="Quantidade" fill={BRAND} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard
          title="Áreas vendidas"
          description="Conta pedidos que tiveram pelo menos um item do setor — não a quantidade de produtos. Um pedido com itens de Breast e Thoracic conta uma vez para cada setor."
        >
          {sectorChartData.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-neutral-400">Sem dados suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, sectorChartData.length * 32)}>
              <BarChart data={sectorChartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis dataKey="label" type="category" {...axisProps} fontSize={10} width={160} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgb(23 22 26 / 0.04)' }} />
                <Bar dataKey="Vendas" fill={INK} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </>,
  )
}
