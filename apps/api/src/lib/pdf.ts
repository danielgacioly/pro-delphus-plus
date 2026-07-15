import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { LABELS, formatMoney, type QuoteLanguage } from './quoteI18n.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPng = fs.readFileSync(path.join(__dirname, '../assets/logo-company.png'))
const logoDataUri = `data:image/png;base64,${logoPng.toString('base64')}`

export const COMPANY = {
  name: 'Pro Delphus Simuladores Cirúrgicos',
  cnpj: 'CNPJ: 07.998.535/0001-42 - Insc. Estadual: 033901287',
  addressLine1: 'Rua Professor Alfeu Rabelo, 169 - Casa Caiada',
  addressLine2: 'Olinda - PE - Brasil - CEP 53.130-420',
  phone: 'Fone/Fax: +55 (81) 3432.7702 / 3431.6148',
  website: 'prodelphus.com',
}

export interface QuotePdfItem {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  photoDataUri: string | null
}

export interface QuotePdfSignature {
  name: string
  jobTitle: string | null
  phone: string | null
  email: string
  signatureImageDataUri: string | null
}

export interface QuotePdfData {
  quoteNumber: string
  language: QuoteLanguage
  clientPrefix: 'NONE' | 'MR' | 'MS'
  clientName: string
  notes: string | null
  items: QuotePdfItem[]
  freight: number | null
  discount: number
  subtotal: number
  total: number
  currency: string
  signature: QuotePdfSignature
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(data: QuotePdfData) {
  const t = LABELS[data.language]
  const money = (value: number) => formatMoney(value, data.currency, data.language)

  const rows = data.items
    .map(
      (item, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td class="num">${item.quantity}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="photo-cell">${
            item.photoDataUri ? `<img src="${item.photoDataUri}" alt="" />` : ''
          }</td>
          <td class="num">${money(item.unitPrice)}</td>
          <td class="num total-cell">${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('')

  const prefix = t.prefix[data.clientPrefix]
  const toLine = [prefix, data.clientName].filter(Boolean).join(' ')

  const freightDisplay = data.freight === null ? t.toBeDefined : money(data.freight)

  const notesBlock = data.notes
    ? `<div class="notes-box">${escapeHtml(data.notes).replace(/\n/g, '<br />')}</div>`
    : '<div class="notes-box"></div>'

  return `<!doctype html>
<html lang="${data.language.toLowerCase()}">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 36px 40px; font-size: 13px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 10px; }
  .company { display: flex; align-items: center; gap: 14px; }
  .company .logo img { width: 78px; height: auto; display: block; }
  .company-name { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
  .company-meta { font-size: 10.5px; color: #4a4a4a; line-height: 1.5; }
  .quote-title { text-align: right; }
  .quote-label { font-size: 34px; font-weight: 800; color: #1a1a1a; line-height: 1; border-bottom: 3px solid #ef1818; padding-bottom: 4px; display: inline-block; }
  .quote-number { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-top: 4px; }
  .to-line { font-size: 13px; font-weight: 700; color: #1a1a1a; margin: 6px 0 16px; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { text-align: left; font-size: 10.5px; text-transform: uppercase; color: #1a1a1a; background: #f1efe9; border: 1px solid #d8d5cb; padding: 8px; }
  table.items td { padding: 8px; font-size: 12px; color: #1a1a1a; border: 1px solid #e5e3da; vertical-align: middle; }
  table.items .num { text-align: center; white-space: nowrap; }
  table.items .total-cell { color: #ef1818; font-weight: 700; text-align: right; }
  .photo-cell { text-align: center; width: 64px; }
  .photo-cell img { max-width: 56px; max-height: 56px; object-fit: contain; }
  .summary { display: flex; margin-top: 0; border: 1px solid #e5e3da; border-top: none; }
  .notes-box { flex: 1; padding: 12px 14px; font-size: 10.5px; color: #4a4a4a; line-height: 1.6; border-right: 1px solid #e5e3da; }
  .totals-box { width: 230px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12px; font-weight: 700; color: #ef1818; border-bottom: 1px solid #e5e3da; }
  .totals-row span:first-child { color: #1a1a1a; }
  .totals-row.grand { font-size: 15px; border-bottom: none; }
  .signature { margin-top: 40px; display: flex; align-items: stretch; border-radius: 6px; overflow: hidden; border: 1px solid #e5e3da; }
  .signature .sig-logo { background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 10px 18px; }
  .signature .sig-logo img { width: 60px; height: auto; }
  .signature .sig-signature { flex: 1; background: #ffffff; display: flex; align-items: center; padding: 10px 24px; border-left: 1px solid #e5e3da; }
  .signature .sig-signature img { max-width: 220px; max-height: 70px; }
  .signature .sig-bar { flex: 1; background: #1a1a1a; color: #ffffff; padding: 12px 20px 12px 24px; display: flex; flex-direction: column; justify-content: center; gap: 2px; border-left: 8px solid #ef1818; }
  .signature .sig-name { font-size: 14px; font-weight: 700; }
  .signature .sig-role { font-size: 10.5px; color: #c9c9c9; margin-bottom: 6px; }
  .signature .sig-contact { font-size: 10.5px; color: #f2f2f2; }
</style>
</head>
<body>
  <header>
    <div class="company">
      <div class="logo"><img src="${logoDataUri}" alt="Pro Delphus" /></div>
      <div>
        <div class="company-name">${escapeHtml(COMPANY.name)}</div>
        <div class="company-meta">${escapeHtml(COMPANY.cnpj)}</div>
        <div class="company-meta">${escapeHtml(COMPANY.addressLine1)}</div>
        <div class="company-meta">${escapeHtml(COMPANY.addressLine2)}</div>
        <div class="company-meta">${escapeHtml(COMPANY.phone)}</div>
      </div>
    </div>
    <div class="quote-title">
      <div class="quote-label">${t.quote}</div>
      <div class="quote-number">#${escapeHtml(data.quoteNumber)}</div>
    </div>
  </header>

  <div class="to-line">${t.to}: ${escapeHtml(toLine)}</div>

  <table class="items">
    <thead>
      <tr>
        <th class="num">${t.item}</th>
        <th class="num">${t.qty}</th>
        <th>${t.description}</th>
        <th>${t.photo}</th>
        <th class="num">${t.unitPrice}</th>
        <th class="num">${t.total}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="summary">
    ${notesBlock}
    <div class="totals-box">
      <div class="totals-row"><span>${t.shipping}</span><span>${freightDisplay}</span></div>
      ${
        data.discount > 0
          ? `<div class="totals-row"><span>${t.discount}</span><span>-${money(data.discount)}</span></div>`
          : ''
      }
      <div class="totals-row grand"><span>${t.total}</span><span>${money(data.total)}</span></div>
    </div>
  </div>

  <div class="signature">
    <div class="sig-logo"><img src="${logoDataUri}" alt="Pro Delphus" /></div>
    ${
      data.signature.signatureImageDataUri
        ? `<div class="sig-signature"><img src="${data.signature.signatureImageDataUri}" alt="" /></div>`
        : `<div class="sig-bar">
      <div class="sig-name">${escapeHtml(data.signature.name)}</div>
      <div class="sig-role">${escapeHtml(data.signature.jobTitle ?? 'Sales Assistant')}</div>
      ${data.signature.phone ? `<div class="sig-contact">${escapeHtml(data.signature.phone)}</div>` : ''}
      <div class="sig-contact">${escapeHtml(data.signature.email)}</div>
      <div class="sig-contact">${escapeHtml(COMPANY.website)}</div>
    </div>`
    }
  </div>
</body>
</html>`
}

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null

async function getBrowser() {
  browserPromise ??= puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  return browserPromise
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(renderHtml(data), { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0' } })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
