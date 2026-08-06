import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
import { AnimatedNumber, Card, Page, SegmentedControl, Skeleton } from '../components/ui'

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

/** Funil orçamento→pedido, recortado por vendedor, setor ou cliente. */
interface Funnel {
  quotes: number
  converted: number
  conversionRate: number
  avgDaysToConvert: number | null
  quotedUSD: number
  quotedBRL: number
  orderedUSD: number
  orderedBRL: number
}

interface Efficiency {
  overall: Funnel & { medianDaysToConvert: number | null }
  bySalesperson: (Funnel & { id: string; name: string })[]
  bySector: (Funnel & { sector: string })[]
  topClients: (Funnel & { clientId: string | null; name: string })[]
  byMonth: { year: number; month: number; quotes: number; converted: number }[]
}

interface StatsResponse {
  totalOrders: number
  totalByCurrency: { USD: number; BRL: number }
  statusBreakdown: { PENDING: number; COMPLETED: number }
  byMonth: MonthStat[]
  byYear: YearStat[]
  topProducts: ProductStat[]
  sectorsSold: SectorStat[]
  efficiency: Efficiency
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

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function days(value: number | null) {
  if (value === null) return '—'
  if (value < 1) return 'Mesmo dia'
  return `${value.toFixed(value < 10 ? 1 : 0)} d`
}

/** Barra de progresso fina — lê a taxa de conversão mais rápido que o número. */
function RateBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-500/12">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.round(rate * 100))}%` }}
        />
      </div>
      <span className="tabular text-[13px] font-medium text-ink-900">{pct(rate)}</span>
    </div>
  )
}

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

/** Tabela de funil reutilizada pelos três recortes (vendedor, setor, cliente). */
function FunnelTable({
  label,
  rows,
  empty,
}: {
  label: string
  rows: { key: string; name: ReactNode; funnel: Funnel }[]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="px-5 pb-6 pt-2 text-[13px] text-neutral-400">{empty}</p>
  }
  return (
    <div className="overflow-x-auto px-2 pb-3">
      <table className="w-full min-w-[420px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-200/70">
            <th className="px-2 py-2 text-left text-eyebrow text-neutral-400">{label}</th>
            <th className="px-2 py-2 text-right text-eyebrow text-neutral-400">Orçam.</th>
            <th className="px-2 py-2 text-right text-eyebrow text-neutral-400">Fechados</th>
            <th className="px-2 py-2 text-left text-eyebrow text-neutral-400">Conversão</th>
            <th className="whitespace-nowrap px-2 py-2 text-right text-eyebrow text-neutral-400">Tempo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-neutral-200/50 last:border-0">
              <td className="max-w-[180px] truncate px-2 py-2.5 text-[13px] font-medium text-ink-900">{row.name}</td>
              <td className="tabular px-2 py-2.5 text-right text-[13px] text-neutral-600">{row.funnel.quotes}</td>
              <td className="tabular px-2 py-2.5 text-right text-[13px] text-neutral-600">{row.funnel.converted}</td>
              <td className="px-2 py-2.5">
                <RateBar rate={row.funnel.conversionRate} />
              </td>
              <td className="tabular whitespace-nowrap px-2 py-2.5 text-right text-[13px] text-neutral-600">
                {days(row.funnel.avgDaysToConvert)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Stats() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })
  const [view, setView] = useState<'sales' | 'efficiency'>('sales')

  const page = (children: ReactNode) => (
    <Page
      title="Métricas"
      description="Vendas por período, status dos pedidos e a eficiência do funil de orçamentos."
      actions={
        <SegmentedControl
          aria-label="Visão das métricas"
          value={view}
          onChange={setView}
          options={[
            { value: 'sales', label: 'Vendas' },
            { value: 'efficiency', label: 'Eficiência' },
          ]}
        />
      }
    >
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

  // A API pode estar numa versão anterior ao bloco de eficiência; sem ela a aba
  // simplesmente não tem o que mostrar, em vez de quebrar a página inteira.
  const eff = data.efficiency

  if (view === 'efficiency') {
    if (!eff) {
      return page(
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          As métricas de eficiência ainda não estão disponíveis nesta versão da API.
        </div>,
      )
    }

    const funnelChartData = eff.byMonth.map((m) => ({
      label: `${monthLabels[m.month - 1]}/${String(m.year).slice(2)}`,
      Orçamentos: m.quotes,
      Fechados: m.converted,
    }))

    return page(
      <>
        {/* `key` por visão: sem isso o React reaproveita os cartões da aba
            anterior e a contagem parte do número errado — "Pedidos totais: 11"
            virava um "1100%" piscando antes de assentar na taxa de conversão. */}
        <div key="efficiency" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Taxa de conversão" value={<AnimatedNumber value={eff.overall.conversionRate} format={pct} />} />
          <StatCard
            label="Orçamentos emitidos"
            value={<AnimatedNumber value={eff.overall.quotes} />}
            sub={`→ ${eff.overall.converted}`}
            delay={40}
          />
          <StatCard
            label="Tempo médio até fechar"
            value={days(eff.overall.avgDaysToConvert)}
            sub={
              eff.overall.medianDaysToConvert !== null
                ? `mediana ${days(eff.overall.medianDaysToConvert).toLowerCase()}`
                : undefined
            }
            delay={80}
          />
          <StatCard
            label="Valor convertido"
            value={<AnimatedNumber value={eff.overall.orderedUSD} format={(v) => `$ ${fmt(v)}`} />}
            sub={`de $ ${fmt(eff.overall.quotedUSD)}`}
            delay={120}
          />
        </div>

        <div className="mt-4">
          <ChartCard
            title="Orçamentos x fechamentos"
            description="Por mês de emissão do orçamento. Um orçamento conta como fechado quando vira pedido, mesmo que o pedido tenha saído em outro mês."
          >
            {funnelChartData.length === 0 ? (
              <p className="px-3 py-10 text-center text-[13px] text-neutral-400">Sem orçamentos ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgb(23 22 26 / 0.04)' }} />
                  {/* Mesmo motivo do gráfico de status: a animação de entrada do
                      recharts não conclui e as barras ficam com altura zero. */}
                  <Bar dataKey="Orçamentos" fill={INK} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Fechados" fill={BRAND} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <ChartCard title="Por vendedor" description="Quem orça mais e quem converte mais.">
            <FunnelTable
              label="Vendedor"
              empty="Nenhum orçamento emitido ainda."
              rows={eff.bySalesperson.map((s) => ({ key: s.id, name: s.name, funnel: s }))}
            />
          </ChartCard>

          <ChartCard title="Por setor" description="Setor de cada item do orçamento — um orçamento misto conta em todos.">
            <FunnelTable
              label="Setor"
              empty="Sem dados por setor ainda."
              rows={eff.bySector.map((s) => ({ key: s.sector, name: s.sector, funnel: s }))}
            />
          </ChartCard>
        </div>

        <div className="mt-4">
          <ChartCard title="Principais clientes" description="Ordenados pelo valor efetivamente fechado.">
            <FunnelTable
              label="Cliente"
              empty="Nenhum cliente com orçamento ainda."
              rows={eff.topClients.map((c) => ({
                key: c.clientId ?? c.name,
                name: c.clientId ? (
                  <Link to={`/clientes/${c.clientId}`} className="hover:text-brand-600">
                    {c.name}
                  </Link>
                ) : (
                  <span title="Orçamento sem cliente cadastrado">{c.name}</span>
                ),
                funnel: c,
              }))}
            />
          </ChartCard>
        </div>
      </>,
    )
  }

  return page(
    <>
      <div key="sales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pedidos totais" value={<AnimatedNumber value={data.totalOrders} />} />
        <StatCard
          label="Vendido (USD)"
          value={<AnimatedNumber value={data.totalByCurrency.USD} format={(v) => `$ ${fmt(v)}`} />}
          delay={40}
        />
        <StatCard
          label="Vendido (BRL)"
          value={<AnimatedNumber value={data.totalByCurrency.BRL} format={(v) => `R$ ${fmt(v)}`} />}
          delay={80}
        />
        <StatCard
          label="Concluídos"
          value={<AnimatedNumber value={data.statusBreakdown.COMPLETED} />}
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
