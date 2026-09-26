import { useEffect, useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatAmount, formatOrderNumber, type OrderDTO, type QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { cn } from '../lib/cn'
import { isInCurrentMonth, isInPreviousWindow, monthWindow, variation } from '../lib/period'
import { Badge, Page, Section, Skeleton } from '../components/ui'
import { NeoAvatar } from '../components/NeoMascot'
import {
  IconBoard,
  IconBook,
  IconBox,
  IconChevronRight,
  IconContacts,
  IconQuote,
  IconRefresh,
  IconTag,
  IconTruck,
} from '../components/icons'

interface Shortcut {
  to: string
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const createActions: Shortcut[] = [
  { to: '/orcamentos/novo', title: 'Novo orçamento', description: 'Monte em PDF ou Excel a partir do catálogo.', icon: IconQuote },
  { to: '/pedidos/novo', title: 'Novo pedido', description: 'Gere invoice e documentos de exportação.', icon: IconTruck },
  { to: '/clientes?novo=1', title: 'Novo cliente', description: 'Cadastre contato, endereços e dados fiscais.', icon: IconContacts },
  { to: '/produtos?novo=1', title: 'Novo produto', description: 'Adicione ao catálogo e à tabela de preços.', icon: IconBox },
]

const secondaryShortcuts: Shortcut[] = [
  { to: '/orcamentos', title: 'Orçamentos', description: 'Todos os orçamentos emitidos', icon: IconQuote },
  { to: '/pedidos', title: 'Pedidos', description: 'Invoice, Packing List e exportação', icon: IconTruck },
  { to: '/clientes', title: 'Clientes', description: 'Contatos, endereços e histórico', icon: IconContacts },
  { to: '/minha-pro-delphus', title: 'Minha Pro Delphus', description: 'Seu mural pessoal de tarefas e lembretes', icon: IconBoard },
  { to: '/precos', title: 'Tabela de preço', description: 'Preços em real, dólar e euro por setor', icon: IconTag },
  { to: '/produtos', title: 'Produtos', description: 'Catálogo, mídia e customizações disponíveis', icon: IconBox },
  { to: '/biblioteca', title: 'Biblioteca', description: 'Perguntas de clientes com a resposta confirmada', icon: IconBook },
]

const currencySymbol: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }

/** Última palavra do rótulo "em vendas em …", que troca junto com o valor. */
const currencyPlural: Record<string, string> = { BRL: 'reais', USD: 'dólares', EUR: 'euros' }

interface MonthSale {
  currency: string
  amount: string
  /** Variação contra o mesmo recorte do mês anterior; null quando não havia base. */
  change: number | null
}

/** Variação percentual; sem base no mês anterior não há porcentagem honesta. */
/** "▲ 12% vs. agosto" — contexto para o número não ficar solto. */
function Change({ value, previousLabel }: { value: number | null; previousLabel: string }) {
  // Sem registro no mês anterior não existe porcentagem honesta — e repetir
  // "sem base" em cada coluna vira ruído. A linha simplesmente não aparece.
  if (value === null) return null
  const up = value >= 0
  return (
    <span
      className={up ? 'text-emerald-700' : 'text-brand-700'}
      title={`Comparado com o mesmo trecho de ${previousLabel}`}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}% vs. {previousLabel}
    </span>
  )
}

interface ExchangeRate {
  pair: string
  rate: number
  pctChange: number
  updatedAt: string
}

const PAIR_LABEL: Record<string, { name: string; symbol: string }> = {
  'USD-BRL': { name: 'Dólar', symbol: 'US$' },
  'EUR-BRL': { name: 'Euro', symbol: '€' },
}

async function fetchRates(refresh = false) {
  const { data } = await api.get<{ rates: ExchangeRate[] }>('/exchange-rates', { params: refresh ? { refresh: 1 } : undefined })
  return data.rates
}

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

async function fetchOrders() {
  const { data } = await api.get<{ orders: OrderDTO[] }>('/orders')
  return data.orders
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CreateCard({ action }: { action: Shortcut }) {
  const { to, title, description, icon: Icon } = action
  return (
    <Link to={to} className="group flex min-h-[88px] items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3.5 py-3 transition-[border-color,box-shadow] duration-150 ease-out hover:border-black/[0.12] hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.014em] text-ink-900 sm:truncate">{title}</h3>
        <p className="mt-0.5 truncate text-[12.5px] leading-snug text-neutral-600">{description}</p>
      </div>
      <IconChevronRight className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={2.2} />
    </Link>
  )
}

const statValue = 'tabular truncate text-[24px] leading-tight font-semibold tracking-[-0.02em] text-ink-900'
const statLabel = 'truncate text-[13px] text-neutral-600'
const statColumn = (divider?: boolean, className?: string) =>
  // O traço separador some quando as colunas empilham no celular.
  cn('min-w-0', divider && 'sm:border-l sm:border-black/[0.07] sm:pl-4', className)

/** Uma coluna do painel do mês: valor tabular grande, rótulo e comparação. */
function MonthStat({
  value,
  label,
  change,
  previousLabel,
  divider,
}: {
  value: ReactNode
  label: string
  change: number | null
  previousLabel: string
  divider?: boolean
}) {
  return (
    <div className={statColumn(divider)}>
      <p className={statValue}>{value}</p>
      <p className={cn('mt-0.5', statLabel)}>{label}</p>
      {change !== null && (
        <p className="tabular mt-1 truncate text-[12px]">
          <Change value={change} previousLabel={previousLabel} />
        </p>
      )}
    </div>
  )
}

const CYCLE_MS = 3800

/**
 * Moedas não se somam, então o total do mês roda entre elas: o valor e a última
 * palavra do rótulo ("…em reais") trocam juntos. Com uma moeda só, fica parado.
 */
function SalesStat({
  sales,
  previousLabel,
  divider,
  className,
}: {
  sales: MonthSale[]
  previousLabel: string
  divider?: boolean
  className?: string
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (sales.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % sales.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [sales])

  const current = sales[index] ?? sales[0]

  return (
    <div className={statColumn(divider, className)}>
      <div>
        <div className="min-w-0">
          <div className="overflow-hidden">
            <p key={index} className={cn('animate-value-roll', statValue)}>
              {current ? current.amount : '—'}
            </p>
          </div>
          <p className={cn('mt-0.5', statLabel)}>
            em vendas
            {current && (
              <>
                {' em '}
                {/* Só a última palavra troca junto com o valor. */}
                <span key={index} className="animate-value-roll inline-block">
                  {currencyPlural[current.currency] ?? current.currency}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      {current?.change != null && (
        <p className="tabular mt-1 truncate text-[12px]">
          <Change value={current.change} previousLabel={previousLabel} />
        </p>
      )}
    </div>
  )
}

/** Cotação do dia de uma moeda, com a variação em relação ao fechamento anterior. */
function RateRow({ pair, rate, pctChange }: ExchangeRate) {
  const label = PAIR_LABEL[pair] ?? { name: pair, symbol: '' }
  const up = pctChange >= 0
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-medium text-ink-900">{label.name}</span>
        <span className="text-[11.5px] text-neutral-500">{label.symbol}</span>
      </div>
      {/* Duas casas: a terceira e a quarta são ruído para quem só quer saber
          como o dia está. */}
      <p className="tabular mt-0.5 text-[20px] leading-tight font-semibold tracking-[-0.02em] whitespace-nowrap text-ink-900">
        R$ {rate.toFixed(2).replace('.', ',')}
      </p>
      <p className={cn('tabular mt-0.5 text-[12px] whitespace-nowrap', up ? 'text-emerald-700' : 'text-brand-700')}>
        {up ? '▲' : '▼'} {Math.abs(pctChange).toFixed(2).replace('.', ',')}% hoje
      </p>
    </div>
  )
}

/** Linha de lista de atividade: identificador + cliente, valor e data à direita. */
function ActivityRow({
  to,
  title,
  subtitle,
  status,
  amount,
  date,
  first,
}: {
  to: string
  title: string
  subtitle: string
  status?: ReactNode
  amount: string
  date: string
  first: boolean
}) {
  return (
    <Link to={to} className="relative flex h-11 items-center gap-3 px-4 transition-colors duration-100 hover:bg-black/[0.025]">
      {!first && <span aria-hidden className="absolute top-0 right-0 left-4 h-px bg-black/[0.06]" />}
      <span className="tabular shrink-0 text-[13px] font-medium text-ink-900">{title}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-600">{subtitle}</span>
      {status && <span className="shrink-0">{status}</span>}
      <span className="tabular shrink-0 text-[13px] text-ink-800">{amount}</span>
      <span className="tabular w-10 shrink-0 text-right text-[12px] text-neutral-500">{date}</span>
    </Link>
  )
}

function ActivityList({ title, to, empty, children }: { title: string; to: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
      <div className="flex h-10 items-center justify-between border-b border-black/[0.06] px-4">
        <h3 className="text-[13px] font-semibold text-ink-900">{title}</h3>
        <Link to={to} className="text-[12.5px] text-brand-600 hover:text-brand-700">
          Ver todos
        </Link>
      </div>
      {empty ? <p className="px-4 py-5 text-[13px] text-neutral-500">Nada por aqui ainda.</p> : children}
    </div>
  )
}

export function Home() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] ?? ''
  const [now, setNow] = useState(() => new Date())

  const { data: quotes, isLoading: loadingQuotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: orders, isLoading: loadingOrders } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })
  const loading = loadingQuotes || loadingOrders

  // A API já guarda a cotação por 5 min; aqui só evitamos refazer a chamada a
  // cada volta para o Início, e uma falha não vira tentativa infinita.
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: rates, isLoading: loadingRates } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => fetchRates(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })

  // O ícone de atualizar pula o cache de 5 min da API e busca a cotação na fonte.
  const refreshRates = useMutation({
    mutationFn: () => fetchRates(true),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['exchange-rates'], fresh)
      setNow(new Date())
    },
    onError: () => toast.error('Não foi possível atualizar o câmbio agora.'),
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const myQuotes = useMemo(
    () => (quotes ?? []).filter((q) => q.createdBy.id === user?.id),
    [quotes, user?.id],
  )
  const myOrders = useMemo(
    () => (orders ?? []).filter((o) => o.createdBy.id === user?.id),
    [orders, user?.id],
  )

  const month = useMemo(() => {
    const now = new Date()
    // A regra do recorte comparável mora em lib/period.ts, com teste.
    const window = monthWindow(now)
    const inThisMonth = (iso: string) => isInCurrentMonth(window, iso)
    const inPreviousWindow = (iso: string) => isInPreviousWindow(window, iso)

    const ordersOfMonth = myOrders.filter((o) => inThisMonth(o.createdAt))
    const ordersBefore = myOrders.filter((o) => inPreviousWindow(o.createdAt))

    // O valor do pedido vive no orçamento vinculado; moedas não se somam entre
    // si, então cada uma vira uma entrada própria (maior primeiro).
    const totalsBy = (list: typeof myOrders) => {
      const totals = new Map<string, number>()
      for (const order of list) {
        const currency = order.quote.currency
        totals.set(currency, (totals.get(currency) ?? 0) + Number(order.quote.total))
      }
      return totals
    }
    const current = totalsBy(ordersOfMonth)
    const previous = totalsBy(ordersBefore)

    const sales: MonthSale[] = [...current.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([currency, total]) => ({
        currency,
        amount: `${currencySymbol[currency] ?? currency} ${formatAmount(total)}`,
        change: variation(total, previous.get(currency) ?? 0),
      }))

    const quotesNow = myQuotes.filter((q) => inThisMonth(q.createdAt)).length
    const quotesBefore = myQuotes.filter((q) => inPreviousWindow(q.createdAt)).length

    return {
      quotes: quotesNow,
      quotesChange: variation(quotesNow, quotesBefore),
      orders: ordersOfMonth.length,
      ordersChange: variation(ordersOfMonth.length, ordersBefore.length),
      sales,
      label: now.toLocaleDateString('pt-BR', { month: 'long' }),
      previousLabel: new Date(window.previousStart).toLocaleDateString('pt-BR', { month: 'long' }),
    }
  }, [myQuotes, myOrders])

  const recentQuotes = useMemo(
    () => [...myQuotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
    [myQuotes],
  )
  const recentOrders = useMemo(
    () => [...myOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
    [myOrders],
  )

  return (
    <Page
      title={`${greeting()}, ${firstName}.`}
      description="Tudo em ordem. Vamos começar?"
    >
      {/* Câmbio divide a faixa do topo com os atalhos de NEO e Biblioteca:
          informação de um lado, onde perguntar do outro. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium text-neutral-600">Câmbio de hoje</p>
            <div className="flex items-center gap-1.5">
              <p className="text-[11.5px] text-neutral-500">Agora, {currentTime}</p>
              <button
                type="button"
                onClick={() => refreshRates.mutate()}
                disabled={refreshRates.isPending}
                title="Atualizar câmbio"
                aria-label="Atualizar câmbio"
                className="-my-1 -mr-1.5 flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors duration-100 hover:bg-black/[0.05] hover:text-ink-900 disabled:opacity-60"
              >
                <IconRefresh className={cn('h-3.5 w-3.5', refreshRates.isPending && 'animate-spin')} />
              </button>
            </div>
          </div>
          {rates && rates.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-x-3 sm:gap-x-4">
              {rates.map((rate, i) => (
                <div key={rate.pair} className={i > 0 ? 'border-l border-black/[0.07] pl-3 sm:pl-4' : undefined}>
                  <RateRow {...rate} />
                </div>
              ))}
            </div>
          ) : loadingRates ? (
            <div className="mt-3 grid grid-cols-2 gap-x-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            // Fonte pública fora do ar não pode deixar um buraco na tela.
            <p className="mt-3 text-[13px] text-neutral-500">Cotação indisponível no momento.</p>
          )}
        </div>

        {/* NEO e Biblioteca dividem a largura ao lado do câmbio: dois atalhos
            quadrados, sem texto de apoio — o título já diz para que serve.
            Branco, preto e vermelho suave: a faixa do topo repete a paleta da
            marca. */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/neo"
            className="group flex min-h-[112px] flex-col justify-between gap-3 rounded-2xl bg-neutral-700 p-4 text-white transition-colors duration-150 ease-out hover:bg-neutral-800"
          >
            <div className="flex items-start justify-between gap-2">
              <NeoAvatar className="h-9 w-9 shrink-0" />
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.12] transition-colors duration-150 group-hover:bg-white/[0.18]">
                <IconChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
            </div>
            <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.014em] text-white">Vamos bater um papo!</h3>
          </Link>

          <Link
            to="/biblioteca"
            className="group flex min-h-[112px] flex-col justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-100 p-4 transition-[background-color,border-color] duration-150 ease-out hover:border-brand-300 hover:bg-brand-200/70"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-xs">
                <IconBook className="h-[18px] w-[18px]" />
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-brand-700 transition-colors duration-150 group-hover:bg-brand-600/15">
                <IconChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
            </div>
            <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.014em] text-brand-900">
              Cliente perguntou? Veja na Biblioteca
            </h3>
          </Link>
        </div>
      </div>

      <Section title="Principal" className="mt-8">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {createActions.map((action) => (
            <CreateCard key={action.to} action={action} />
          ))}
        </div>
      </Section>

      <Section title="Minha atividade recente" className="mt-8">
        <div className="mb-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
          <p className="text-[13px] font-medium text-neutral-600">Em {month.label}, você fez</p>
          {loading ? (
            <div className="mt-3 flex gap-10">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <MonthStat
                value={month.quotes}
                label="orçamentos"
                change={month.quotesChange}
                previousLabel={month.previousLabel}
              />
              <MonthStat
                value={month.orders}
                label="pedidos"
                change={month.ordersChange}
                previousLabel={month.previousLabel}
                divider
              />
              <SalesStat
                sales={month.sales}
                previousLabel={month.previousLabel}
                divider
                className="col-span-2 sm:col-span-1"
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <ActivityList title="Orçamentos" to="/orcamentos" empty={!loading && recentQuotes.length === 0}>
            {loading
              ? <div className="space-y-2 px-4 py-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4" />)}</div>
              : recentQuotes.map((q, i) => (
                  <ActivityRow
                    key={q.id}
                    to={`/orcamentos/${q.id}/editar`}
                    title={q.quoteNumber}
                    subtitle={q.clientName}
                    amount={`${currencySymbol[q.currency] ?? q.currency} ${formatAmount(q.total)}`}
                    date={shortDate(q.createdAt)}
                    first={i === 0}
                  />
                ))}
          </ActivityList>

          <ActivityList title="Pedidos" to="/pedidos" empty={!loading && recentOrders.length === 0}>
            {loading
              ? <div className="space-y-2 px-4 py-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4" />)}</div>
              : recentOrders.map((o, i) => (
                  <ActivityRow
                    key={o.id}
                    to={`/pedidos/${o.id}`}
                    title={`#${formatOrderNumber(o.orderNumber)}`}
                    subtitle={o.quote.clientName}
                    status={
                      <Badge tone={o.status === 'COMPLETED' ? 'success' : 'warning'} dot>
                        {o.status === 'COMPLETED' ? 'Concluído' : 'Pendente'}
                      </Badge>
                    }
                    amount={`${currencySymbol[o.quote.currency] ?? o.quote.currency} ${formatAmount(o.quote.total)}`}
                    date={shortDate(o.createdAt)}
                    first={i === 0}
                  />
                ))}
          </ActivityList>
        </div>
      </Section>

      <Section title="Mais ferramentas" className="mt-8">
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {secondaryShortcuts.map(({ to, title, description, icon: Icon }, i) => (
            <Link key={to} to={to} className="group relative flex h-11 items-center gap-3 px-4 transition-colors duration-100 hover:bg-black/[0.025]">
              {i > 0 && <span aria-hidden className="absolute top-0 right-0 left-11 h-px bg-black/[0.06]" />}
              <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-600" />
              <span className="text-[14px] font-medium text-ink-900">{title}</span>
              <span className="hidden truncate text-[13px] text-neutral-600 sm:inline">{description}</span>
              <IconChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-500" strokeWidth={2.2} />
            </Link>
          ))}
        </div>
      </Section>

    </Page>
  )
}
