import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

export const statsRouter = Router()

statsRouter.use(requireAuth, requireRole('ADMIN'))

const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const orders = await prisma.order.findMany({
      include: {
        quote: { include: { items: { include: { product: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const totalByCurrency = { USD: 0, BRL: 0 }
    const statusBreakdown = { PENDING: 0, COMPLETED: 0 }
    const byMonthMap = new Map<string, { year: number; month: number; count: number; totalUSD: number; totalBRL: number }>()
    const byYearMap = new Map<number, { year: number; count: number; totalUSD: number; totalBRL: number }>()
    const productMap = new Map<string, { productName: string; quantity: number; revenueUSD: number; revenueBRL: number }>()
    // Counts orders that touched each sector — not units sold. A single
    // order with 100 units of one product still counts once for its
    // sector; an order spanning Breast + Thoracic counts once for each.
    const sectorMap = new Map<string, number>()

    for (const order of orders) {
      const currency: 'USD' | 'BRL' = order.quote.language === 'PT' ? 'BRL' : 'USD'
      const total = Number(order.quote.total)
      const date = order.createdAt
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthKey = `${year}-${MONTH_KEYS[month - 1]}`

      totalByCurrency[currency] += total
      statusBreakdown[order.status] += 1

      const monthEntry = byMonthMap.get(monthKey) ?? { year, month, count: 0, totalUSD: 0, totalBRL: 0 }
      monthEntry.count += 1
      monthEntry[currency === 'USD' ? 'totalUSD' : 'totalBRL'] += total
      byMonthMap.set(monthKey, monthEntry)

      const yearEntry = byYearMap.get(year) ?? { year, count: 0, totalUSD: 0, totalBRL: 0 }
      yearEntry.count += 1
      yearEntry[currency === 'USD' ? 'totalUSD' : 'totalBRL'] += total
      byYearMap.set(year, yearEntry)

      for (const item of order.quote.items) {
        const productEntry = productMap.get(item.product.name) ?? {
          productName: item.product.name,
          quantity: 0,
          revenueUSD: 0,
          revenueBRL: 0,
        }
        productEntry.quantity += item.quantity
        productEntry[currency === 'USD' ? 'revenueUSD' : 'revenueBRL'] += Number(item.lineTotal)
        productMap.set(item.product.name, productEntry)
      }

      const sectorsInOrder = new Set(order.quote.items.flatMap((item) => item.product.sectors))
      for (const sector of sectorsInOrder) {
        sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + 1)
      }
    }

    const byMonth = Array.from(byMonthMap.values()).sort((a, b) => a.year - b.year || a.month - b.month)
    const byYear = Array.from(byYearMap.values()).sort((a, b) => a.year - b.year)
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
    const sectorsSold = Array.from(sectorMap.entries())
      .map(([sector, salesCount]) => ({ sector, salesCount }))
      .sort((a, b) => b.salesCount - a.salesCount)

    res.json({
      totalOrders: orders.length,
      totalByCurrency,
      statusBreakdown,
      byMonth,
      byYear,
      topProducts,
      sectorsSold,
      efficiency: await computeEfficiency(),
    })
  }),
)

const DAY_MS = 24 * 60 * 60 * 1000

interface Funnel {
  quotes: number
  converted: number
  /** Soma dos dias orçamento→pedido, só dos convertidos — divide por `converted`. */
  daysSum: number
  quotedUSD: number
  quotedBRL: number
  orderedUSD: number
  orderedBRL: number
}

function emptyFunnel(): Funnel {
  return { quotes: 0, converted: 0, daysSum: 0, quotedUSD: 0, quotedBRL: 0, orderedUSD: 0, orderedBRL: 0 }
}

function funnelOut(f: Funnel) {
  return {
    quotes: f.quotes,
    converted: f.converted,
    conversionRate: f.quotes > 0 ? f.converted / f.quotes : 0,
    avgDaysToConvert: f.converted > 0 ? f.daysSum / f.converted : null,
    quotedUSD: f.quotedUSD,
    quotedBRL: f.quotedBRL,
    orderedUSD: f.orderedUSD,
    orderedBRL: f.orderedBRL,
  }
}

/**
 * Funil orçamento→pedido. Um orçamento conta como convertido quando existe
 * pelo menos um pedido apontando para ele; o tempo de conversão usa o pedido
 * mais antigo, que é o momento em que o cliente de fato fechou.
 *
 * EUR é agrupado junto com USD nos totais porque as vendas em euro são raras e
 * os gráficos só têm duas séries — a métrica aqui é volume relativo, não
 * contabilidade.
 */
async function computeEfficiency() {
  const quotes = await prisma.quote.findMany({
    include: {
      createdBy: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      orders: { select: { createdAt: true } },
      items: { select: { product: { select: { sectors: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const overall = emptyFunnel()
  const bySeller = new Map<string, Funnel & { id: string; name: string }>()
  const bySector = new Map<string, Funnel>()
  const byClient = new Map<string, Funnel & { clientId: string | null; name: string }>()
  const byMonthMap = new Map<string, { year: number; month: number; quotes: number; converted: number }>()
  const conversionDays: number[] = []

  for (const quote of quotes) {
    const total = Number(quote.total)
    const bucket: 'USD' | 'BRL' = quote.currency === 'BRL' ? 'BRL' : 'USD'
    const firstOrder = quote.orders.reduce<Date | null>(
      (earliest, o) => (!earliest || o.createdAt < earliest ? o.createdAt : earliest),
      null,
    )
    const days = firstOrder ? Math.max(0, (firstOrder.getTime() - quote.createdAt.getTime()) / DAY_MS) : null

    const apply = (f: Funnel) => {
      f.quotes += 1
      f[bucket === 'USD' ? 'quotedUSD' : 'quotedBRL'] += total
      if (firstOrder) {
        f.converted += 1
        f[bucket === 'USD' ? 'orderedUSD' : 'orderedBRL'] += total
        if (days !== null) f.daysSum += days
      }
    }

    apply(overall)
    if (days !== null) conversionDays.push(days)

    const sellerKey = quote.createdBy.id
    const seller =
      bySeller.get(sellerKey) ?? { ...emptyFunnel(), id: quote.createdBy.id, name: quote.createdBy.name }
    apply(seller)
    bySeller.set(sellerKey, seller)

    // Nome do cadastro quando existe; senão o snapshot do documento, para que
    // orçamentos anteriores ao cadastro de clientes ainda apareçam no ranking.
    const clientKey = quote.clientId ?? `name:${quote.clientName.trim().toLowerCase()}`
    const client =
      byClient.get(clientKey) ??
      { ...emptyFunnel(), clientId: quote.clientId, name: quote.client?.name ?? quote.clientName }
    apply(client)
    byClient.set(clientKey, client)

    // Um setor por orçamento, não por item: um orçamento com 5 modelos de
    // mama conta uma vez para "Mama".
    const sectors = new Set(quote.items.flatMap((i) => i.product.sectors))
    for (const sector of sectors) {
      const entry = bySector.get(sector) ?? emptyFunnel()
      apply(entry)
      bySector.set(sector, entry)
    }

    const year = quote.createdAt.getFullYear()
    const month = quote.createdAt.getMonth() + 1
    const monthKey = `${year}-${MONTH_KEYS[month - 1]}`
    const monthEntry = byMonthMap.get(monthKey) ?? { year, month, quotes: 0, converted: 0 }
    monthEntry.quotes += 1
    if (firstOrder) monthEntry.converted += 1
    byMonthMap.set(monthKey, monthEntry)
  }

  const sorted = [...conversionDays].sort((a, b) => a - b)
  const medianDaysToConvert =
    sorted.length === 0
      ? null
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2

  return {
    overall: { ...funnelOut(overall), medianDaysToConvert },
    bySalesperson: Array.from(bySeller.values())
      .map((s) => ({ id: s.id, name: s.name, ...funnelOut(s) }))
      .sort((a, b) => b.converted - a.converted || b.quotes - a.quotes),
    bySector: Array.from(bySector.entries())
      .map(([sector, f]) => ({ sector, ...funnelOut(f) }))
      .sort((a, b) => b.quotes - a.quotes),
    topClients: Array.from(byClient.values())
      .map((c) => ({ clientId: c.clientId, name: c.name, ...funnelOut(c) }))
      .sort((a, b) => b.orderedUSD + b.orderedBRL - (a.orderedUSD + a.orderedBRL) || b.quotes - a.quotes)
      .slice(0, 10),
    byMonth: Array.from(byMonthMap.values()).sort((a, b) => a.year - b.year || a.month - b.month),
  }
}
