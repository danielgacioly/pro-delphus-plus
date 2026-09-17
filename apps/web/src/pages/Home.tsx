import { useEffect, useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatAmount, formatOrderNumber, type OrderDTO, type QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import { Badge, ButtonLink, Page, Section, Skeleton } from '../components/ui'
import { NeoAvatar } from '../components/NeoMascot'
import {
  IconBoard,
  IconBox,
  IconChevronRight,
  IconContacts,
  IconPlus,
  IconQuote,
  IconTag,
  IconTruck,
} from '../components/icons'

interface Shortcut {
  to: string
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Orçamentos, Pedidos e Clientes são o fluxo do dia a dia — ganham tiles.
// O resto é ferramenta de apoio e vira lista agrupada: a hierarquia vem da
// forma diferente, não de repetir o mesmo card em dois tamanhos.
const primaryShortcuts: Shortcut[] = [
  {
    to: '/orcamentos',
    title: 'Orçamentos',
    description: 'Gere orçamentos em PDF ou Excel a partir do catálogo.',
    icon: IconQuote,
  },
  {
    to: '/pedidos',
    title: 'Pedidos',
    description: 'Invoice, Packing List e documentos de exportação.',
    icon: IconTruck,
  },
  {
    to: '/clientes',
    title: 'Clientes',
    description: 'Contatos, endereços e o histórico de cada cliente.',
    icon: IconContacts,
  },
]

const secondaryShortcuts: Shortcut[] = [
  {
    to: '/minha-pro-delphus',
    title: 'Minha Pro Delphus',
    description: 'Seu mural pessoal de tarefas e lembretes',
    icon: IconBoard,
  },
  {
    to: '/precos',
    title: 'Tabela de preços',
    description: 'Preços em real, dólar e euro por setor',
    icon: IconTag,
  },
  {
    to: '/produtos',
    title: 'Produtos',
    description: 'Catálogo, mídia e customizações disponíveis',
    icon: IconBox,
  },
]

const currencySymbol: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }

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

function PrimaryTile({ shortcut }: { shortcut: Shortcut }) {
  const { to, title, description, icon: Icon } = shortcut
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-black/[0.06] bg-white p-4 transition-[border-color,box-shadow] duration-150 ease-out hover:border-black/[0.12] hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-brand-600" />
      <div className="pt-5">
        <h3 className="flex items-center gap-1 text-[16px] font-semibold tracking-[-0.02em] text-ink-900">
          {title}
          <IconChevronRight
            className="h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            strokeWidth={2.2}
          />
        </h3>
        <p className="mt-0.5 text-[13px] leading-snug text-neutral-600">{description}</p>
      </div>
    </Link>
  )
}

/** Uma coluna do painel do mês: valor tabular grande, rótulo discreto embaixo. */
function MonthStat({
  value,
  label,
  divider,
  className,
}: {
  value: ReactNode
  label: string
  divider?: boolean
  className?: string
}) {
  return (
    // O traço separador some quando as colunas empilham no celular.
    <div className={cn('min-w-0', divider && 'sm:border-l sm:border-black/[0.07] sm:pl-4', className)}>
      <p className="tabular truncate text-[19px] leading-tight font-semibold tracking-[-0.02em] text-ink-900">{value}</p>
      <p className="mt-0.5 truncate text-[12.5px] text-neutral-500">{label}</p>
    </div>
  )
}

const CYCLE_MS = 3800

/**
 * Moedas não se somam, então o total do mês roda entre elas: cada valor sobe
 * para o lugar do anterior. Com uma moeda só, fica parado.
 */
function CyclingValue({ values }: { values: string[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (values.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % values.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [values])

  if (values.length === 0) return <>—</>

  return (
    <span className="block overflow-hidden">
      <span key={index} className="animate-value-roll block truncate">
        {values[index] ?? values[0]}
      </span>
    </span>
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
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-500">{subtitle}</span>
      {status && <span className="shrink-0">{status}</span>}
      <span className="tabular shrink-0 text-[13px] text-ink-800">{amount}</span>
      <span className="tabular w-10 shrink-0 text-right text-[12px] text-neutral-400">{date}</span>
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
      {empty ? <p className="px-4 py-5 text-[13px] text-neutral-400">Nada por aqui ainda.</p> : children}
    </div>
  )
}

export function Home() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] ?? ''
  const isAdmin = user?.role === 'ADMIN'

  const { data: quotes, isLoading: loadingQuotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: orders, isLoading: loadingOrders } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })
  const loading = loadingQuotes || loadingOrders

  const myQuotes = useMemo(
    () => (quotes ?? []).filter((q) => q.createdBy.id === user?.id),
    [quotes, user?.id],
  )
  const myOrders = useMemo(
    () => (orders ?? []).filter((o) => o.createdBy.id === user?.id),
    [orders, user?.id],
  )

  const month = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const since = (iso: string) => new Date(iso).getTime() >= start.getTime()

    const ordersOfMonth = myOrders.filter((o) => since(o.createdAt))
    // O valor do pedido vive no orçamento vinculado; moedas não se somam entre
    // si, então cada uma vira uma linha própria (maior primeiro).
    const byCurrency = new Map<string, number>()
    for (const order of ordersOfMonth) {
      const currency = order.quote.currency
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + Number(order.quote.total))
    }
    const sales = [...byCurrency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([currency, total]) => `${currencySymbol[currency] ?? currency} ${formatAmount(total)}`)

    return {
      quotes: myQuotes.filter((q) => since(q.createdAt)).length,
      orders: ordersOfMonth.length,
      sales,
      label: new Date().toLocaleDateString('pt-BR', { month: 'long' }),
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
    <Page title={`${greeting()}, ${firstName}.`} description="Tudo em ordem. Vamos começar?">
      {/* Duas colunas na largura inteira: cada botão bate com metade do card do
          NEO logo abaixo, mantendo a mesma grade do resto da página. */}
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <ButtonLink to="/orcamentos/novo" variant="primary" size="lg" className="w-full justify-start">
          <IconPlus className="h-4 w-4 shrink-0" strokeWidth={2} />
          Novo Orçamento
        </ButtonLink>
        <ButtonLink to="/pedidos/novo" variant="primary" size="lg" className="w-full justify-start">
          <IconPlus className="h-4 w-4 shrink-0" strokeWidth={2} />
          Novo Pedido
        </ButtonLink>
        <ButtonLink to="/clientes?novo=1" size="lg" className="w-full justify-start">
          <IconPlus className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={2} />
          Novo Cliente
        </ButtonLink>
        {isAdmin && (
          <ButtonLink to="/produtos/novo" size="lg" className="w-full justify-start">
            <IconPlus className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={2} />
            Novo Produto
          </ButtonLink>
        )}
      </div>

      <Link
        to="/neo"
        className="group mt-4 flex flex-col items-start gap-4 rounded-2xl bg-ink-900 p-4 text-white transition-colors duration-150 ease-out hover:bg-ink-800 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3.5">
          <NeoAvatar className="h-10 w-10 shrink-0" />
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.014em] text-white">Vamos bater um papo!</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-white/55">
              Pergunte ao NEO sobre preços, clientes e produtos, ou peça para montar um orçamento ou um pedido por você.
            </p>
          </div>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-lg bg-white/[0.12] px-3.5 text-[13px] font-medium text-white transition-colors duration-150 group-hover:bg-white/[0.18] sm:self-auto">
          Conversar
          <IconChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </Link>

      <Section title="Principal" className="mt-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {primaryShortcuts.map((shortcut) => (
            <PrimaryTile key={shortcut.to} shortcut={shortcut} />
          ))}
        </div>
      </Section>

      <Section title="Minha atividade recente" className="mt-8">
        <div className="mb-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
          <p className="text-[13px] font-medium text-neutral-500">Em {month.label}, você fez</p>
          {loading ? (
            <div className="mt-3 flex gap-10">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <MonthStat value={month.quotes} label="orçamentos" />
              <MonthStat value={month.orders} label="pedidos" divider />
              <MonthStat
                value={<CyclingValue values={month.sales} />}
                label="em vendas"
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
            <Link
              key={to}
              to={to}
              className="group relative flex h-11 items-center gap-3 px-4 transition-colors duration-100 hover:bg-black/[0.025]"
            >
              {/* Separador recuado até o texto, como nas listas agrupadas do macOS. */}
              {i > 0 && <span aria-hidden className="absolute top-0 right-0 left-11 h-px bg-black/[0.06]" />}
              <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-500" />
              <span className="text-[14px] font-medium text-ink-900">{title}</span>
              <span className="hidden truncate text-[13px] text-neutral-500 sm:inline">{description}</span>
              <IconChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-400" strokeWidth={2.2} />
            </Link>
          ))}
        </div>
      </Section>
    </Page>
  )
}
