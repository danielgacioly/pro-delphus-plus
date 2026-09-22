import { renderPdf } from './browser.js'
import { escapeHtml } from './html.js'
import { formatMoney } from './quoteI18n.js'
import { COMPANY, logoDataUri } from './pdf.js'
import { MONTH_NAMES_PT, type MonthlyReportData } from './monthlyReport.js'
import type { MonthlyInsights } from './monthlyReportInsights.js'

const money = (value: number, currency: 'USD' | 'BRL') => formatMoney(value, currency, 'PT')
const pct = (value: number) => `${Math.round(value * 100)}%`
const monthLabel = (year: number, month: number) => `${MONTH_NAMES_PT[month - 1]} de ${year}`

/**
 * Barra horizontal simples (div com largura em %) — mesma linguagem visual
 * da RateBar do front (Stats.tsx), só que em HTML puro porque o Puppeteer
 * renderiza sem o CSS do app.
 */
function rateBar(rate: number) {
  return `<div class="ratebar"><div class="ratebar-track"><div class="ratebar-fill" style="width:${Math.min(100, Math.round(rate * 100))}%"></div></div><span>${pct(rate)}</span></div>`
}

/** Gráfico de barras verticais em SVG puro — sem lib de gráfico, só geometria. */
function barChartSvg(points: { label: string; value: number }[], color: string) {
  const width = 640
  const height = 160
  const padBottom = 24
  const padTop = 12
  const barGap = 14
  const barWidth = (width - barGap * (points.length + 1)) / points.length
  const max = Math.max(...points.map((p) => p.value), 1)

  const bars = points
    .map((p, i) => {
      const barHeight = Math.max(2, ((height - padBottom - padTop) * p.value) / max)
      const x = barGap + i * (barWidth + barGap)
      const y = height - padBottom - barHeight
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="${color}" />
        <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#8a8a8a">${escapeHtml(p.label)}</text>
      `
    })
    .join('')

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${bars}</svg>`
}

function deltaBadge(curr: number, prev: number, { invert = false }: { invert?: boolean } = {}) {
  if (prev === 0 && curr === 0) return ''
  if (prev === 0) return `<span class="badge badge-up">novo</span>`
  const change = ((curr - prev) / prev) * 100
  const isUp = change >= 0
  const good = invert ? !isUp : isUp
  return `<span class="badge ${good ? 'badge-up' : 'badge-down'}">${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}%</span>`
}

function insightList(items: string[], tone: 'up' | 'down' | 'focus') {
  return `<ul class="insight-list insight-${tone}">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
}

function funnelTableRows(rows: { name: string; quotes: number; converted: number; conversionRate: number }[], emptyLabel: string) {
  if (rows.length === 0) return `<tr><td colspan="4" class="empty">${emptyLabel}</td></tr>`
  return rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td class="num">${r.quotes}</td>
        <td class="num">${r.converted}</td>
        <td>${rateBar(r.conversionRate)}</td>
      </tr>`,
    )
    .join('')
}

export function buildMonthlyReportHtml(data: MonthlyReportData, insights: MonthlyInsights) {
  const { month: m, previousMonth: p } = data
  const title = `Relatório de Métricas do Mês de ${monthLabel(m.year, m.month)} — Pro Delphus+`
  const generatedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Recife' }).format(
    data.generatedAt,
  )

  const nextMonthLabel = m.month === 12 ? monthLabel(m.year + 1, 1) : monthLabel(m.year, m.month + 1)
  const trendUSD = data.revenueTrend.map((t) => ({ label: `${MONTH_NAMES_PT[t.month - 1]!.slice(0, 3)}/${String(t.year).slice(2)}`, value: t.totalUSD }))
  const trendBRL = data.revenueTrend.map((t) => ({ label: `${MONTH_NAMES_PT[t.month - 1]!.slice(0, 3)}/${String(t.year).slice(2)}`, value: t.totalBRL }))
  const hasUSD = trendUSD.some((t) => t.value > 0)
  const hasBRL = trendBRL.some((t) => t.value > 0)

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 36px 40px; font-size: 12.5px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; margin-bottom: 18px; border-bottom: 3px solid #ef1818; }
  .company { display: flex; align-items: center; gap: 14px; }
  .company img { width: 72px; height: auto; display: block; }
  .company-name { font-size: 12px; color: #8a8a8a; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 21px; margin: 0; line-height: 1.25; }
  .report-title .generated { font-size: 10.5px; color: #8a8a8a; margin-top: 4px; }

  .kpis { display: flex; gap: 10px; margin-bottom: 20px; }
  .kpi { flex: 1; border: 1px solid #e5e3da; border-radius: 10px; padding: 12px 14px; }
  .kpi .label { font-size: 10px; text-transform: uppercase; color: #8a8a8a; letter-spacing: .03em; }
  .kpi .value { font-size: 19px; font-weight: 700; margin-top: 4px; }
  .kpi .value .unit { font-size: 11px; font-weight: 500; color: #8a8a8a; }
  .badge { display: inline-block; margin-left: 6px; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 20px; }
  .badge-up { background: #dcfce7; color: #15803d; }
  .badge-down { background: #fee2e2; color: #b91c1c; }

  section { margin-bottom: 22px; }
  h2 { font-size: 14px; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e3da; }

  .charts { display: flex; gap: 16px; }
  .chart-box { flex: 1; border: 1px solid #e5e3da; border-radius: 10px; padding: 10px 12px; }
  .chart-box .chart-title { font-size: 11px; color: #4a4a4a; font-weight: 600; margin-bottom: 4px; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #8a8a8a; border-bottom: 1px solid #d8d5cb; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0eee7; font-size: 12px; }
  td.num { text-align: center; white-space: nowrap; }
  td.empty { color: #8a8a8a; text-align: center; padding: 14px; }

  .ratebar { display: flex; align-items: center; gap: 8px; }
  .ratebar-track { width: 60px; height: 6px; border-radius: 6px; background: #f0eee7; overflow: hidden; }
  .ratebar-fill { height: 100%; background: #ef1818; border-radius: 6px; }
  .ratebar span { font-size: 11px; font-weight: 600; width: 32px; }

  .insight-list { margin: 0; padding-left: 0; list-style: none; }
  .insight-list li { position: relative; padding: 5px 0 5px 18px; font-size: 12px; line-height: 1.5; }
  .insight-list li::before { content: ''; position: absolute; left: 0; top: 11px; width: 7px; height: 7px; border-radius: 50%; }
  .insight-up li::before { background: #15803d; }
  .insight-down li::before { background: #dc2626; }
  .insight-focus li::before { background: #1a1a1a; }

  .two-col { display: flex; gap: 18px; }
  .two-col > div { flex: 1; }

  footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e3da; font-size: 10px; color: #8a8a8a; }
</style>
</head>
<body>
  <header>
    <div class="company">
      <img src="${logoDataUri}" alt="Pro Delphus" />
      <div class="company-name">${escapeHtml(COMPANY.name)}</div>
    </div>
    <div class="report-title">
      <h1>${escapeHtml(title)}</h1>
      <div class="generated">Gerado em ${escapeHtml(generatedAt)}</div>
    </div>
  </header>

  <div class="kpis">
    <div class="kpi">
      <div class="label">Pedidos fechados</div>
      <div class="value">${m.orders}${deltaBadge(m.orders, p.orders)}</div>
    </div>
    <div class="kpi">
      <div class="label">Faturamento USD</div>
      <div class="value">${money(m.revenueUSD, 'USD')}${deltaBadge(m.revenueUSD, p.revenueUSD)}</div>
    </div>
    <div class="kpi">
      <div class="label">Faturamento BRL</div>
      <div class="value">${money(m.revenueBRL, 'BRL')}${deltaBadge(m.revenueBRL, p.revenueBRL)}</div>
    </div>
    <div class="kpi">
      <div class="label">Conversão orçamento → pedido</div>
      <div class="value">${pct(m.conversionRate)}${deltaBadge(m.conversionRate, p.conversionRate)}</div>
    </div>
  </div>

  ${
    hasUSD || hasBRL
      ? `<section>
    <h2>Tendência de faturamento — últimos 6 meses</h2>
    <div class="charts">
      ${hasUSD ? `<div class="chart-box"><div class="chart-title">USD</div>${barChartSvg(trendUSD, '#ef1818')}</div>` : ''}
      ${hasBRL ? `<div class="chart-box"><div class="chart-title">BRL</div>${barChartSvg(trendBRL, '#1a1a1a')}</div>` : ''}
    </div>
  </section>`
      : ''
  }

  <section>
    <h2>Destaques do mês</h2>
    ${insightList(insights.highlights, 'up')}
  </section>

  <section>
    <h2>Pontos de atenção</h2>
    ${insightList(insights.watchouts, 'down')}
  </section>

  <section>
    <h2>Foco para ${escapeHtml(nextMonthLabel)}</h2>
    ${insightList(insights.focus, 'focus')}
  </section>

  <section class="two-col">
    <div>
      <h2>Por vendedor</h2>
      <table>
        <thead><tr><th>Nome</th><th class="num">Orçam.</th><th class="num">Fechados</th><th>Conversão</th></tr></thead>
        <tbody>${funnelTableRows(data.bySalesperson, 'Sem orçamento neste mês.')}</tbody>
      </table>
    </div>
    <div>
      <h2>Por setor</h2>
      <table>
        <thead><tr><th>Setor</th><th class="num">Orçam.</th><th class="num">Fechados</th><th>Conversão</th></tr></thead>
        <tbody>${funnelTableRows(data.bySector.map((s) => ({ name: s.sector, ...s })), 'Sem orçamento neste mês.')}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Clientes em destaque</h2>
    <table>
      <thead><tr><th>Cliente</th><th class="num">Orçam.</th><th class="num">Fechados</th><th>Conversão</th><th class="num">Faturado</th></tr></thead>
      <tbody>
        ${
          data.topClients.length === 0
            ? `<tr><td colspan="5" class="empty">Sem orçamento neste mês.</td></tr>`
            : data.topClients
                .map(
                  (c) => `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td class="num">${c.quotes}</td>
            <td class="num">${c.converted}</td>
            <td>${rateBar(c.conversionRate)}</td>
            <td class="num">${[c.orderedUSD > 0 ? money(c.orderedUSD, 'USD') : null, c.orderedBRL > 0 ? money(c.orderedBRL, 'BRL') : null].filter(Boolean).join(' + ') || '—'}</td>
          </tr>`,
                )
                .join('')
        }
      </tbody>
    </table>
  </section>

  <footer>Pro Delphus+ — relatório gerado automaticamente a partir dos dados do sistema. Não compartilhe fora da equipe sem revisar antes.</footer>
</body>
</html>`
}

export async function generateMonthlyReportPdf(data: MonthlyReportData, insights: MonthlyInsights): Promise<Buffer> {
  return renderPdf(buildMonthlyReportHtml(data, insights), { format: 'A4', printBackground: true, margin: { top: '0', bottom: '0' } })
}
