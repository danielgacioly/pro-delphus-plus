import puppeteer from 'puppeteer'
import { formatAmount } from '@prodelphusplus/shared'
import { COMPANY } from './pdf.js'

export interface PriceListPdfProduct {
  sku: string
  name: string
  description: string | null
  components: string | null
  sectors: string[]
  kind: 'COMPLETE_MODEL' | 'COMPONENT'
  priceBRL: string | null
  priceUSD: string | null
  priceEUR: string | null
  priceUSDDistributor: string | null
}

export interface PriceListPdfColumns {
  description: boolean
  components: boolean
  brl: boolean
  usd: boolean
  eur: boolean
  usdDistributor: boolean
}

export interface PriceListPdfData {
  products: PriceListPdfProduct[]
  columns: PriceListPdfColumns
  search: string | null
  generatedAt: Date
}

const kindLabel: Record<PriceListPdfProduct['kind'], string> = {
  COMPLETE_MODEL: 'Modelo completo',
  COMPONENT: 'Componentes / Peças',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatPrice(value: string | null, currency: string) {
  return value === null ? '—' : `${currency} ${formatAmount(value)}`
}

// A product listed in more than one sector shows up once per sector it belongs to.
function groupBySector(products: PriceListPdfProduct[]) {
  const bySector = new Map<string, { COMPLETE_MODEL: PriceListPdfProduct[]; COMPONENT: PriceListPdfProduct[] }>()
  for (const product of products) {
    for (const sector of product.sectors) {
      const group = bySector.get(sector) ?? { COMPLETE_MODEL: [], COMPONENT: [] }
      group[product.kind].push(product)
      bySector.set(sector, group)
    }
  }
  return Array.from(bySector.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}

function renderHtml(data: PriceListPdfData) {
  const grouped = groupBySector(data.products)

  const sectionsHtml = grouped
    .map(([sector, groups]) => {
      const kindsHtml = (['COMPLETE_MODEL', 'COMPONENT'] as const)
        .map((kind) => {
          const items = groups[kind]
          if (items.length === 0) return ''
          const rows = items
            .map(
              (product) => `
                <tr>
                  <td class="sku">${escapeHtml(product.sku)}</td>
                  <td>${escapeHtml(product.name)}</td>
                  ${data.columns.description ? `<td class="desc">${escapeHtml(product.description ?? '—')}</td>` : ''}
                  ${
                    data.columns.components && kind === 'COMPLETE_MODEL'
                      ? `<td class="desc">${escapeHtml(product.components ?? '—')}</td>`
                      : ''
                  }
                  ${data.columns.brl ? `<td class="num">${formatPrice(product.priceBRL, 'BRL')}</td>` : ''}
                  ${data.columns.usd ? `<td class="num">${formatPrice(product.priceUSD, 'USD')}</td>` : ''}
                  ${data.columns.eur ? `<td class="num">${formatPrice(product.priceEUR, 'EUR')}</td>` : ''}
                  ${
                    data.columns.usdDistributor
                      ? `<td class="num">${formatPrice(product.priceUSDDistributor, 'USD')}</td>`
                      : ''
                  }
                </tr>`,
            )
            .join('')

          return `
            <div class="kind-block">
              <h3>${kindLabel[kind]}</h3>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nome</th>
                    ${data.columns.description ? '<th>Descrição</th>' : ''}
                    ${data.columns.components && kind === 'COMPLETE_MODEL' ? '<th>Componentes</th>' : ''}
                    ${data.columns.brl ? '<th class="num">Final BRL</th>' : ''}
                    ${data.columns.usd ? '<th class="num">Final USD</th>' : ''}
                    ${data.columns.eur ? '<th class="num">Final EUR</th>' : ''}
                    ${data.columns.usdDistributor ? '<th class="num">Distribuidor USD</th>' : ''}
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`
        })
        .join('')

      return `
        <div class="sector-block">
          <h2>${escapeHtml(sector)}</h2>
          ${kindsHtml}
        </div>`
    })
    .join('')

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px 36px; font-size: 11px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ef1818; padding-bottom: 12px; margin-bottom: 16px; }
  .company-name { font-size: 15px; font-weight: 700; }
  .company-meta { font-size: 10px; color: #4a4a4a; margin-top: 2px; }
  .title-block { text-align: right; }
  .title { font-size: 22px; font-weight: 800; }
  .meta { font-size: 10px; color: #4a4a4a; margin-top: 4px; }
  .sector-block { margin-bottom: 18px; page-break-inside: avoid; }
  .sector-block h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #d8d5cb; padding-bottom: 4px; margin: 0 0 8px; }
  .kind-block { margin-bottom: 10px; }
  .kind-block h3 { font-size: 10px; text-transform: uppercase; color: #6a6a6a; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #e5e3da; padding: 5px 7px; text-align: left; }
  th { background: #f1efe9; font-size: 9.5px; text-transform: uppercase; }
  td.sku { font-weight: 700; white-space: nowrap; }
  td.desc { font-size: 9.5px; color: #4a4a4a; }
  td.num, th.num { text-align: right; white-space: nowrap; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="company-name">${escapeHtml(COMPANY.name)}</div>
      <div class="company-meta">${escapeHtml(COMPANY.cnpj)}</div>
      <div class="company-meta">${escapeHtml(COMPANY.website)}</div>
    </div>
    <div class="title-block">
      <div class="title">Tabela de Preços</div>
      <div class="meta">Gerado em ${data.generatedAt.toLocaleString('pt-BR')}</div>
      ${data.search ? `<div class="meta">Filtro: "${escapeHtml(data.search)}"</div>` : ''}
    </div>
  </header>
  ${sectionsHtml}
</body>
</html>`
}

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null

async function getBrowser() {
  browserPromise ??= puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  return browserPromise
}

export async function generatePriceListPdf(data: PriceListPdfData): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(renderHtml(data), { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
