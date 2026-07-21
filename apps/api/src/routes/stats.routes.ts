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
    })
  }),
)
