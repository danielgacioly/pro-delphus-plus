import { prisma } from './prisma.js'

/**
 * Dados do relatório mensal de métricas — mês fechado (por padrão, o mês
 * anterior ao atual: setembro só vira relatório completo em outubro) contra
 * o mês anterior a ele, pra dar pra comparar "subiu ou caiu" de verdade.
 *
 * Reaproveita os mesmos conceitos de stats.routes.ts (funil orçamento→
 * pedido, câmbio gravado no pedido para o equivalente em BRL), mas
 * recortado por mês — o /stats normal soma tudo desde sempre, o que não
 * serve pra "como foi este mês".
 */

export const MONTH_NAMES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

/** O mês anterior ao mês corrente — o último mês "fechado" pra virar relatório. */
export function previousClosedMonth(now = new Date()) {
  const month = now.getMonth() === 0 ? 12 : now.getMonth()
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  return { year, month }
}

function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

interface Funnel {
  quotes: number
  converted: number
  quotedUSD: number
  quotedBRL: number
  orderedUSD: number
  orderedBRL: number
  daysSum: number
}

function emptyFunnel(): Funnel {
  return { quotes: 0, converted: 0, quotedUSD: 0, quotedBRL: 0, orderedUSD: 0, orderedBRL: 0, daysSum: 0 }
}

function funnelOut(f: Funnel) {
  return {
    quotes: f.quotes,
    converted: f.converted,
    conversionRate: f.quotes > 0 ? f.converted / f.quotes : 0,
    avgDaysToConvert: f.converted > 0 ? f.daysSum / f.converted : null,
    orderedUSD: f.orderedUSD,
    orderedBRL: f.orderedBRL,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

type QuoteRow = Awaited<ReturnType<typeof fetchQuotesBetween>>[number]

async function fetchQuotesBetween(start: Date, end: Date) {
  return prisma.quote.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      createdBy: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      orders: { select: { createdAt: true } },
      items: { select: { quantity: true, lineTotal: true, product: { select: { name: true, sectors: true } } } },
    },
  })
}

function quoteBucket(q: QuoteRow) {
  return (q.currency === 'BRL' ? 'BRL' : 'USD') as 'USD' | 'BRL'
}

function quoteFirstOrder(q: QuoteRow) {
  return q.orders.reduce<Date | null>((earliest, o) => (!earliest || o.createdAt < earliest ? o.createdAt : earliest), null)
}

/** Funil geral de um conjunto de orçamentos — usado pro mês do relatório e pro mês anterior a ele. */
function overallFunnel(quotes: QuoteRow[]) {
  const f = emptyFunnel()
  for (const q of quotes) {
    const total = Number(q.total)
    const bucket = quoteBucket(q)
    const firstOrder = quoteFirstOrder(q)
    f.quotes += 1
    f[bucket === 'USD' ? 'quotedUSD' : 'quotedBRL'] += total
    if (firstOrder) {
      f.converted += 1
      f[bucket === 'USD' ? 'orderedUSD' : 'orderedBRL'] += total
      f.daysSum += Math.max(0, (firstOrder.getTime() - q.createdAt.getTime()) / DAY_MS)
    }
  }
  return funnelOut(f)
}

/** Receita fechada (pedidos) num intervalo — mesma lógica de conversão a BRL do /stats. */
async function revenueBetween(start: Date, end: Date) {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { quote: { select: { currency: true, total: true } }, exchangeRate: true },
  })
  let totalUSD = 0
  let totalBRL = 0
  for (const o of orders) {
    const isBRL = o.quote.currency === 'BRL'
    const total = Number(o.quote.total)
    const exchangeRate = o.exchangeRate !== null ? Number(o.exchangeRate) : null
    if (!isBRL) totalUSD += total
    totalBRL += isBRL ? total : exchangeRate !== null ? total * exchangeRate : 0
  }
  return { orders: orders.length, totalUSD, totalBRL }
}

export interface MonthSummary {
  year: number
  month: number
  orders: number
  revenueUSD: number
  revenueBRL: number
  quotes: number
  converted: number
  conversionRate: number
  avgDaysToConvert: number | null
}

export interface MonthlyReportData {
  generatedAt: Date
  month: MonthSummary
  previousMonth: MonthSummary
  bySalesperson: { name: string; quotes: number; converted: number; conversionRate: number; orderedUSD: number; orderedBRL: number }[]
  bySector: { sector: string; quotes: number; converted: number; conversionRate: number }[]
  topClients: { name: string; quotes: number; converted: number; conversionRate: number; avgDaysToConvert: number | null; orderedUSD: number; orderedBRL: number }[]
  /** Orçaram no mês e, até a geração do relatório, não viraram pedido — a "perda" mais acionável que existe. */
  openOpportunities: { name: string; quotes: number; quotedUSD: number; quotedBRL: number }[]
  /** Faturamento dos últimos 6 meses (incluindo o do relatório), pro gráfico de tendência. */
  revenueTrend: { year: number; month: number; totalUSD: number; totalBRL: number }[]
}

export async function buildMonthlyReportData(year: number, month: number): Promise<MonthlyReportData> {
  const { start, end } = monthRange(year, month)
  const prev = shiftMonth(year, month, -1)
  const { start: prevStart, end: prevEnd } = monthRange(prev.year, prev.month)
  const trendStart = shiftMonth(year, month, -5)

  const [quotes, prevQuotes, revenue, prevRevenue, trendOrders] = await Promise.all([
    fetchQuotesBetween(start, end),
    fetchQuotesBetween(prevStart, prevEnd),
    revenueBetween(start, end),
    revenueBetween(prevStart, prevEnd),
    prisma.order.findMany({
      where: { createdAt: { gte: monthRange(trendStart.year, trendStart.month).start, lt: end } },
      select: { createdAt: true, exchangeRate: true, quote: { select: { currency: true, total: true } } },
    }),
  ])

  const funnel = overallFunnel(quotes)
  const prevFunnel = overallFunnel(prevQuotes)

  const monthSummary: MonthSummary = { year, month, orders: revenue.orders, revenueUSD: revenue.totalUSD, revenueBRL: revenue.totalBRL, ...funnel }
  const previousMonthSummary: MonthSummary = {
    year: prev.year,
    month: prev.month,
    orders: prevRevenue.orders,
    revenueUSD: prevRevenue.totalUSD,
    revenueBRL: prevRevenue.totalBRL,
    ...prevFunnel,
  }

  // Recortes por vendedor/setor/cliente, só do mês do relatório.
  const bySeller = new Map<string, Funnel & { name: string }>()
  const bySector = new Map<string, Funnel>()
  const byClient = new Map<string, Funnel & { name: string }>()
  const openByClient = new Map<string, { name: string; quotes: number; quotedUSD: number; quotedBRL: number }>()

  for (const q of quotes) {
    const total = Number(q.total)
    const bucket = quoteBucket(q)
    const firstOrder = quoteFirstOrder(q)
    const apply = (f: Funnel) => {
      f.quotes += 1
      f[bucket === 'USD' ? 'quotedUSD' : 'quotedBRL'] += total
      if (firstOrder) {
        f.converted += 1
        f[bucket === 'USD' ? 'orderedUSD' : 'orderedBRL'] += total
        f.daysSum += Math.max(0, (firstOrder.getTime() - q.createdAt.getTime()) / DAY_MS)
      }
    }

    const seller = bySeller.get(q.createdBy.id) ?? { ...emptyFunnel(), name: q.createdBy.name }
    apply(seller)
    bySeller.set(q.createdBy.id, seller)

    const clientKey = q.clientId ?? `name:${q.clientName.trim().toLowerCase()}`
    const clientName = q.client?.name ?? q.clientName
    const client = byClient.get(clientKey) ?? { ...emptyFunnel(), name: clientName }
    apply(client)
    byClient.set(clientKey, client)

    if (!firstOrder) {
      const open = openByClient.get(clientKey) ?? { name: clientName, quotes: 0, quotedUSD: 0, quotedBRL: 0 }
      open.quotes += 1
      open[bucket === 'USD' ? 'quotedUSD' : 'quotedBRL'] += total
      openByClient.set(clientKey, open)
    }

    const sectors = new Set(q.items.flatMap((i) => i.product.sectors))
    for (const sector of sectors) {
      const entry = bySector.get(sector) ?? emptyFunnel()
      apply(entry)
      bySector.set(sector, entry)
    }
  }

  const revenueTrendMap = new Map<string, { year: number; month: number; totalUSD: number; totalBRL: number }>()
  for (const o of trendOrders) {
    const y = o.createdAt.getUTCFullYear()
    const m = o.createdAt.getUTCMonth() + 1
    const key = `${y}-${m}`
    const entry = revenueTrendMap.get(key) ?? { year: y, month: m, totalUSD: 0, totalBRL: 0 }
    const isBRL = o.quote.currency === 'BRL'
    const total = Number(o.quote.total)
    const exchangeRate = o.exchangeRate !== null ? Number(o.exchangeRate) : null
    if (!isBRL) entry.totalUSD += total
    entry.totalBRL += isBRL ? total : exchangeRate !== null ? total * exchangeRate : 0
    revenueTrendMap.set(key, entry)
  }
  // Preenche os 6 meses mesmo quando algum não teve pedido nenhum — sem isso
  // o gráfico de tendência "pula" um mês em vez de mostrar a queda a zero.
  const revenueTrend = Array.from({ length: 6 }, (_, i) => {
    const { year: y, month: m } = shiftMonth(trendStart.year, trendStart.month, i)
    return revenueTrendMap.get(`${y}-${m}`) ?? { year: y, month: m, totalUSD: 0, totalBRL: 0 }
  })

  return {
    generatedAt: new Date(),
    month: monthSummary,
    previousMonth: previousMonthSummary,
    bySalesperson: Array.from(bySeller.values())
      .map((s) => ({ name: s.name, ...funnelOut(s) }))
      .toSorted((a, b) => b.orderedUSD + b.orderedBRL - (a.orderedUSD + a.orderedBRL)),
    bySector: Array.from(bySector.entries())
      .map(([sector, f]) => ({ sector, ...funnelOut(f) }))
      .toSorted((a, b) => b.quotes - a.quotes),
    topClients: Array.from(byClient.values())
      .map((c) => ({ name: c.name, ...funnelOut(c) }))
      .toSorted((a, b) => b.orderedUSD + b.orderedBRL - (a.orderedUSD + a.orderedBRL))
      .slice(0, 8),
    openOpportunities: Array.from(openByClient.values())
      .toSorted((a, b) => b.quotedUSD + b.quotedBRL - (a.quotedUSD + a.quotedBRL))
      .slice(0, 8),
    revenueTrend,
  }
}
