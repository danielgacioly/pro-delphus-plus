import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMonthlyInsights } from './monthlyReportInsights.js'
import type { MonthlyReportData } from './monthlyReport.js'

function baseData(overrides: Partial<MonthlyReportData> = {}): MonthlyReportData {
  return {
    generatedAt: new Date('2026-10-01'),
    month: { year: 2026, month: 9, orders: 4, revenueUSD: 12000, revenueBRL: 0, quotes: 10, converted: 4, conversionRate: 0.4, avgDaysToConvert: 5 },
    previousMonth: { year: 2026, month: 8, orders: 3, revenueUSD: 9000, revenueBRL: 0, quotes: 10, converted: 3, conversionRate: 0.3, avgDaysToConvert: 7 },
    bySalesperson: [],
    bySector: [],
    topClients: [],
    openOpportunities: [],
    revenueTrend: [],
    ...overrides,
  }
}

describe('buildMonthlyInsights', () => {
  it('lê alta de faturamento e de conversão como destaque, não como alerta', () => {
    const { highlights, watchouts } = buildMonthlyInsights(baseData())
    assert.ok(highlights.some((h) => h.includes('Faturamento em USD') && h.includes('alta')))
    assert.ok(highlights.some((h) => h.includes('Taxa de conversão')))
    assert.ok(!watchouts.some((w) => w.includes('Faturamento em USD')))
  })

  it('lê queda de faturamento e de conversão como alerta', () => {
    const data = baseData({
      month: { year: 2026, month: 9, orders: 2, revenueUSD: 5000, revenueBRL: 0, quotes: 10, converted: 2, conversionRate: 0.2, avgDaysToConvert: 5 },
    })
    const { watchouts } = buildMonthlyInsights(data)
    assert.ok(watchouts.some((w) => w.includes('Faturamento em USD') && w.includes('queda')))
    assert.ok(watchouts.some((w) => w.includes('Taxa de conversão')))
  })

  it('não compara faturamento quando o mês anterior não teve venda naquela moeda', () => {
    const data = baseData({ previousMonth: { ...baseData().previousMonth, revenueUSD: 0 } })
    const { highlights } = buildMonthlyInsights(data)
    assert.ok(highlights.some((h) => h.includes('não teve pedido fechado nessa moeda')))
  })

  it('aponta oportunidade em aberto como alerta e sugere retomar contato', () => {
    const data = baseData({
      openOpportunities: [
        { name: 'Hospital São Lucas', quotes: 1, quotedUSD: 4000, quotedBRL: 0 },
        { name: 'Clínica Vera Cruz', quotes: 1, quotedUSD: 2000, quotedBRL: 0 },
      ],
    })
    const { watchouts, focus } = buildMonthlyInsights(data)
    assert.ok(watchouts.some((w) => w.includes('2 cliente(s) orçaram')))
    assert.ok(focus.some((f) => f.includes('Hospital São Lucas')))
  })

  it('ignora setor com um orçamento só (ruído), mas usa setor com dois ou mais', () => {
    const data = baseData({
      bySector: [
        { sector: 'Setor Raro', quotes: 1, converted: 0, conversionRate: 0 },
        { sector: 'Cardiologia', quotes: 5, converted: 1, conversionRate: 0.2 },
        { sector: 'Ortopedia', quotes: 5, converted: 4, conversionRate: 0.8 },
      ],
    })
    const { highlights, watchouts } = buildMonthlyInsights(data)
    assert.ok(!highlights.some((h) => h.includes('Setor Raro')))
    assert.ok(highlights.some((h) => h.includes('Ortopedia')))
    assert.ok(watchouts.some((w) => w.includes('Cardiologia')))
  })

  it('nunca devolve listas vazias — sempre tem algo pra mostrar', () => {
    const { highlights, watchouts, focus } = buildMonthlyInsights(
      baseData({
        month: { year: 2026, month: 9, orders: 0, revenueUSD: 0, revenueBRL: 0, quotes: 0, converted: 0, conversionRate: 0, avgDaysToConvert: null },
        previousMonth: { year: 2026, month: 8, orders: 0, revenueUSD: 0, revenueBRL: 0, quotes: 0, converted: 0, conversionRate: 0, avgDaysToConvert: null },
      }),
    )
    assert.ok(highlights.length > 0)
    assert.ok(watchouts.length > 0)
    assert.ok(focus.length > 0)
  })
})
