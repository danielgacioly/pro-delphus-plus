import { MONTH_NAMES_PT, type MonthlyReportData } from './monthlyReport.js'
import { formatMoney } from './quoteI18n.js'

/**
 * Texto do relatório mensal — observações, o que preocupa e onde focar no
 * mês seguinte. Tudo calculado a partir dos números reais do mês (nunca
 * gerado por IA): cada frase é rastreável até um campo de MonthlyReportData,
 * pra um relatório que o dono do negócio vai usar pra decidir coisa não
 * correr risco de inventar um número ou uma tendência que não existe.
 */

export interface MonthlyInsights {
  highlights: string[]
  watchouts: string[]
  focus: string[]
}

const money = (value: number, currency: 'USD' | 'BRL') => formatMoney(value, currency, 'PT')

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES_PT[month - 1]} de ${year}`
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function trend(curr: number, prev: number) {
  if (curr > prev) return 'alta'
  if (curr < prev) return 'queda'
  return 'estável'
}

export function buildMonthlyInsights(data: MonthlyReportData): MonthlyInsights {
  const { month: m, previousMonth: p } = data
  const prevLabel = monthLabel(p.year, p.month)
  const highlights: string[] = []
  const watchouts: string[] = []
  const focus: string[] = []

  // --- Faturamento, por moeda (USD e BRL não se somam) ---
  for (const currency of ['USD', 'BRL'] as const) {
    const curr = currency === 'USD' ? m.revenueUSD : m.revenueBRL
    const prev = currency === 'USD' ? p.revenueUSD : p.revenueBRL
    if (curr === 0 && prev === 0) continue
    const change = pctChange(curr, prev)
    const line =
      change === null
        ? `Faturamento em ${currency}: ${money(curr, currency)} (${prevLabel} não teve pedido fechado nessa moeda pra comparar).`
        : `Faturamento em ${currency}: ${money(curr, currency)}, ${trend(curr, prev)} de ${Math.abs(change).toFixed(0)}% sobre ${prevLabel} (${money(prev, currency)}).`
    ;(change !== null && change < 0 ? watchouts : highlights).push(line)
  }

  // --- Conversão orçamento → pedido ---
  const rateDeltaPts = Math.round((m.conversionRate - p.conversionRate) * 100)
  const conversionLine = `Taxa de conversão: ${Math.round(m.conversionRate * 100)}% (${m.converted} de ${m.quotes} orçamentos), ${rateDeltaPts >= 0 ? '+' : ''}${rateDeltaPts} pontos sobre ${prevLabel} (${Math.round(p.conversionRate * 100)}%).`
  ;(rateDeltaPts < 0 ? watchouts : highlights).push(conversionLine)

  // --- Ciclo de venda (dias até converter) ---
  if (m.avgDaysToConvert !== null && p.avgDaysToConvert !== null) {
    const dayDelta = m.avgDaysToConvert - p.avgDaysToConvert
    if (Math.abs(dayDelta) >= 1) {
      const line = `Ciclo médio de venda: ${m.avgDaysToConvert.toFixed(1)} dias, ${dayDelta > 0 ? `${dayDelta.toFixed(1)} dias mais lento` : `${Math.abs(dayDelta).toFixed(1)} dias mais rápido`} que ${prevLabel}.`
      ;(dayDelta > 0 ? watchouts : highlights).push(line)
    }
  }

  // --- Melhor vendedor do mês ---
  const topSeller = data.bySalesperson.find((s) => s.orderedUSD + s.orderedBRL > 0)
  if (topSeller) {
    highlights.push(
      `${topSeller.name} liderou o mês: ${topSeller.converted} pedido(s) fechado(s) de ${topSeller.quotes} orçamento(s) (${Math.round(topSeller.conversionRate * 100)}% de conversão).`,
    )
  }

  // --- Setores: melhor e pior conversão (só quem teve orçamento suficiente pra não virar ruído) ---
  const relevantSectors = data.bySector.filter((s) => s.quotes >= 2)
  if (relevantSectors.length > 0) {
    const best = relevantSectors.toSorted((a, b) => b.conversionRate - a.conversionRate)[0]!
    const worst = relevantSectors.toSorted((a, b) => a.conversionRate - b.conversionRate)[0]!
    if (best.sector !== worst.sector) {
      highlights.push(`Setor com melhor conversão: ${best.sector} (${Math.round(best.conversionRate * 100)}%, ${best.converted}/${best.quotes}).`)
      if (worst.conversionRate < m.conversionRate) {
        watchouts.push(`Setor com menor conversão: ${worst.sector} (${Math.round(worst.conversionRate * 100)}%, ${worst.converted}/${worst.quotes}).`)
        focus.push(`Rever o que está travando ${worst.sector} — ${worst.quotes - worst.converted} orçamento(s) parado(s) nesse setor.`)
      }
    }
  }

  // --- Oportunidades em aberto (orçaram e não converteram ainda) ---
  if (data.openOpportunities.length > 0) {
    const totalUSD = data.openOpportunities.reduce((s, o) => s + o.quotedUSD, 0)
    const totalBRL = data.openOpportunities.reduce((s, o) => s + o.quotedBRL, 0)
    const parts = [totalUSD > 0 ? money(totalUSD, 'USD') : null, totalBRL > 0 ? money(totalBRL, 'BRL') : null].filter(Boolean)
    watchouts.push(
      `${data.openOpportunities.length} cliente(s) orçaram em ${monthLabel(m.year, m.month)} e ainda não fecharam pedido — ${parts.join(' + ')} em orçamento parado.`,
    )
    const named = data.openOpportunities.slice(0, 3).map((o) => o.name)
    focus.push(`Retomar contato com: ${named.join(', ')}${data.openOpportunities.length > 3 ? ' e outros' : ''} — orçamento já feito, só falta fechar.`)
  }

  // --- Vendedor abaixo da média geral, com volume que já diz alguma coisa ---
  const belowAverage = data.bySalesperson.filter((s) => s.quotes >= 2 && s.conversionRate < m.conversionRate)
  if (belowAverage.length > 0 && data.bySalesperson.length > 1) {
    const names = belowAverage.map((s) => s.name).join(', ')
    focus.push(`Conversão abaixo da média do mês (${Math.round(m.conversionRate * 100)}%) em: ${names} — vale entender o que está diferente nesses orçamentos.`)
  }

  if (highlights.length === 0) highlights.push('Sem destaque de alta este mês — os números ficaram estáveis ou abaixo do mês anterior.')
  if (watchouts.length === 0) watchouts.push('Nenhum ponto de atenção relevante identificado este mês.')
  if (focus.length === 0) focus.push(`Manter o ritmo de ${monthLabel(m.year, m.month)} — não há oportunidade parada nem setor travado se destacando.`)

  return { highlights, watchouts, focus }
}
