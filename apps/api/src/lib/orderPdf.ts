import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { COMPANY } from './pdf.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPng = fs.readFileSync(path.join(__dirname, '../assets/logo-company.png'))
const logoDataUri = `data:image/png;base64,${logoPng.toString('base64')}`

// Pro Delphus's own bank details for international wire transfers — fixed, same on every invoice/packing list.
const BANK = {
  name: 'Banco XP',
  number: '348',
  branch: '0001',
  account: '393136590',
  swift: 'BCXPBRSP',
  iban: 'BR6933264668000010016172061C1',
  beneficiaryName: 'Pro Delphus Simuladores Cirúrgicos',
  beneficiaryCode: '07.998.535/0001-42',
}

// Customs classification code for these educational simulator products — constant across orders.
const NCM_HS_CODE = '90230000'

export interface OrderDocItem {
  title: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface OrderDocData {
  orderNumber: number
  invoiceDate: Date
  purchaseOrder: string
  orderedByEmail: string
  items: OrderDocItem[]
  currency: string
  freight: number | null
  paypalFee: number | null
  total: number
  billToText: string
  shipToText: string
  numberOfPackages: string | null
  netWeightKg: string | null
  grossWeightKg: string | null
  awbNumber: string | null
  incoterms: string | null
  prepaymentBy: 'PAYPAL' | 'WIRE_TRANSFER'
  nfDate: Date | null
  nfNumber: string | null
}

export interface PackingListBoxItem {
  title: string
  quantity: number
}

export interface PackingListBoxData {
  orderNumber: number
  shipToText: string
  items: PackingListBoxItem[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />')
}

function fmtPlain(value: number) {
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `$ ${formatted}`
}

function fmtWithCurrency(value: number, currency: string) {
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${currency}$ ${formatted}`
}

function fmtDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(date: Date) {
  return date.toLocaleDateString('pt-BR')
}

function renderItemDescription(item: OrderDocItem) {
  const title = `<strong>${escapeHtml(item.title)}</strong>`
  const description = item.description.trim()
  if (!description) return title
  return `${title}<br /><span class="item-desc">${nl2br(description)}</span>`
}

const RED = '#ef1818'
const INK = '#1a1a1a'
const MUTED = '#6a6a6a'
const BORDER = '#e2e0d8'
const PANEL_BG = '#f7f6f2'

const SHARED_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${INK}; margin: 0; padding: 40px 44px; font-size: 11.5px; line-height: 1.45; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .company { display: flex; align-items: center; gap: 14px; }
  .company .logo img { width: 64px; height: auto; display: block; }
  .company-name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
  .company-meta { font-size: 9px; color: ${MUTED}; line-height: 1.5; }
  .doc-meta { border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; min-width: 220px; }
  .doc-meta .row { padding: 7px 12px; border-top: 1px solid ${BORDER}; text-align: right; }
  .doc-meta .row:first-child { border-top: none; }
  .doc-meta .row-label { font-size: 8px; font-weight: 700; letter-spacing: 0.4px; color: ${MUTED}; text-transform: uppercase; display: block; margin-bottom: 1px; }
  .doc-meta .row-value { font-size: 11px; font-weight: 600; }
  .title-row { display: flex; align-items: baseline; gap: 16px; margin: 4px 0 20px; }
  .doc-title { font-size: 30px; font-weight: 800; letter-spacing: 0.5px; border-bottom: 3px solid ${RED}; padding-bottom: 4px; }
  .doc-number { border: 1.5px solid ${INK}; border-radius: 6px; padding: 5px 16px; font-size: 17px; font-weight: 800; }
  table.items { width: 100%; border-collapse: collapse; border: 1px solid ${BORDER}; border-radius: 8px 8px 0 0; overflow: hidden; }
  table.items thead th { font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; padding: 9px 12px; text-align: left; }
  table.items thead .desc-head { background: ${RED}; color: #ffffff; }
  table.items thead .num-head { background: #f1efe9; color: ${INK}; text-align: center; }
  table.items td { border-top: 1px solid ${BORDER}; padding: 10px 12px; vertical-align: top; font-size: 10.5px; }
  table.items td.num { text-align: center; white-space: nowrap; vertical-align: middle; font-variant-numeric: tabular-nums; }
  .item-desc { color: #444; font-size: 9.5px; font-style: italic; display: block; margin-top: 2px; }
  .total-bar { display: flex; justify-content: flex-end; align-items: center; gap: 14px; border: 1px solid ${BORDER}; border-top: none; border-radius: 0 0 8px 8px; padding: 10px 14px; margin-bottom: 22px; }
  .total-bar .label { font-size: 11px; font-weight: 700; letter-spacing: 0.3px; }
  .total-bar .value { font-size: 15px; font-weight: 800; color: ${RED}; }
  .info-grid { display: flex; gap: 14px; margin-bottom: 16px; align-items: stretch; }
  .info-col { flex: 1; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; }
  .info-col h3 { margin: 0; font-size: 9.5px; font-weight: 700; letter-spacing: 0.4px; text-align: left; background: ${PANEL_BG}; padding: 7px 12px; border-bottom: 1px solid ${BORDER}; }
  .info-col .body { padding: 10px 12px; font-size: 10px; line-height: 1.6; }
  .info-side { width: 190px; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .info-side .cell { padding: 7px 12px; border-top: 1px solid ${BORDER}; font-size: 9.5px; }
  .info-side .cell:first-child { border-top: none; }
  .info-side .cell b { display: block; font-size: 8px; font-weight: 700; letter-spacing: 0.3px; color: ${MUTED}; text-transform: uppercase; margin-bottom: 1px; }
  .section { border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
  .section-title { background: ${PANEL_BG}; font-weight: 700; font-size: 10px; letter-spacing: 0.4px; padding: 7px 12px; border-bottom: 1px solid ${BORDER}; }
  .payment-grid { display: flex; border-bottom: 1px solid ${BORDER}; }
  .payment-grid:last-child { border-bottom: none; }
  .payment-grid .cell { flex: 1; padding: 7px 12px; font-size: 9.5px; border-right: 1px solid ${BORDER}; }
  .payment-grid .cell:last-child { border-right: none; }
  .payment-grid .cell b { display: block; font-size: 8px; font-weight: 700; letter-spacing: 0.3px; color: ${MUTED}; text-transform: uppercase; margin-bottom: 1px; }
  .additional { padding: 10px 14px; font-size: 9px; text-align: center; line-height: 1.7; color: #444; }
  .additional .date-line { text-align: left; font-weight: 700; color: ${INK}; margin-bottom: 6px; font-size: 9.5px; }
  footer { margin-top: 8px; text-align: center; font-size: 8.5px; color: ${MUTED}; }
`

function renderInvoiceLikeHtml(data: OrderDocData, mode: 'invoice' | 'packing-list') {
  const isInvoice = mode === 'invoice'
  const title = isInvoice ? 'INVOICE' : 'PACKING LIST'

  const rows = data.items
    .map(
      (item) => `
        <tr>
          <td>${renderItemDescription(item)}</td>
          <td class="num">${item.quantity}</td>
          ${isInvoice ? `<td class="num">${fmtPlain(item.unitPrice)}</td>` : '<td class="num"></td>'}
          ${isInvoice ? `<td class="num">${fmtPlain(item.lineTotal)}</td>` : '<td class="num"></td>'}
        </tr>`,
    )
    .join('')

  const extraRows = isInvoice
    ? [
        data.freight !== null ? `<tr><td></td><td class="num"></td><td class="num">Shipping</td><td class="num">${fmtPlain(data.freight)}</td></tr>` : '',
        data.paypalFee !== null
          ? `<tr><td></td><td class="num"></td><td class="num">PayPal</td><td class="num">${fmtPlain(data.paypalFee)}</td></tr>`
          : '',
      ].join('')
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${SHARED_STYLE}</style>
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
    <div class="doc-meta">
      <div class="row"><span class="row-label">Date</span><span class="row-value">${escapeHtml(fmtDate(data.invoiceDate))}</span></div>
      <div class="row"><span class="row-label">Purchase Order #</span><span class="row-value">${escapeHtml(data.purchaseOrder)}</span></div>
      <div class="row"><span class="row-label">Ordered By</span><span class="row-value">${escapeHtml(data.orderedByEmail)}</span></div>
    </div>
  </header>

  <div class="title-row">
    <div class="doc-title">${title}</div>
    <div class="doc-number">${data.orderNumber}</div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="desc-head">ITEM DESCRIPTION</th>
        <th class="num-head">QTY.</th>
        <th class="num-head">PRICE</th>
        <th class="num-head">TOTAL PRICE</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${extraRows}
    </tbody>
  </table>
  <div class="total-bar">
    <span class="label">TOTAL</span>
    <span class="value">${isInvoice ? fmtWithCurrency(data.total, data.currency) : '—'}</span>
  </div>

  <div class="info-grid">
    <div class="info-col">
      <h3>BILL TO</h3>
      <div class="body">${nl2br(data.billToText)}</div>
    </div>
    <div class="info-col">
      <h3>SHIP TO</h3>
      <div class="body">${nl2br(data.shipToText)}</div>
    </div>
    <div class="info-side">
      <div class="cell"><b>Number of Packages</b>${escapeHtml(data.numberOfPackages ?? '—')}</div>
      <div class="cell"><b>Net Weight</b>${escapeHtml(data.netWeightKg ? `${data.netWeightKg} KG` : '—')}</div>
      <div class="cell"><b>Gross Weight</b>${escapeHtml(data.grossWeightKg ? `${data.grossWeightKg} KG` : '—')}</div>
      <div class="cell"><b>AWB #</b>${escapeHtml(data.awbNumber ?? '—')}</div>
      <div class="cell"><b>Incoterms</b>${escapeHtml(data.incoterms ?? '—')}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">PAYMENT DETAILS</div>
    <div class="payment-grid">
      <div class="cell"><b>Payment Terms</b>Prepayment by ${data.prepaymentBy === 'PAYPAL' ? 'PayPal' : 'Wire Transfer'}</div>
      <div class="cell"><b>Currency</b>${escapeHtml(data.currency)}$</div>
    </div>
    <div class="payment-grid">
      <div class="cell"><b>Bank Name</b>${escapeHtml(BANK.name)}</div>
      <div class="cell"><b>Bank Number</b>${escapeHtml(BANK.number)}</div>
      <div class="cell"><b>Branch</b>${escapeHtml(BANK.branch)}</div>
      <div class="cell"><b>Account Number</b>${escapeHtml(BANK.account)}</div>
    </div>
    <div class="payment-grid">
      <div class="cell"><b>Swift Code</b>${escapeHtml(BANK.swift)}</div>
      <div class="cell"><b>IBAN Code</b>${escapeHtml(BANK.iban)}</div>
    </div>
    <div class="payment-grid">
      <div class="cell"><b>Beneficiary Name</b>${escapeHtml(BANK.beneficiaryName)}</div>
      <div class="cell"><b>Beneficiary Code</b>${escapeHtml(BANK.beneficiaryCode)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ADDITIONAL INFORMATION</div>
    <div class="additional">
      <div class="date-line">DATE: ${data.nfDate ? escapeHtml(fmtDateShort(data.nfDate)) : '—'}
        &nbsp;&nbsp;·&nbsp;&nbsp;CONCERNING SALES RECEIPT NUMBER ${escapeHtml(data.nfNumber ?? '—')}
        &nbsp;&nbsp;&nbsp;&nbsp;NCM/HS ${NCM_HS_CODE}
      </div>
      Made of Fiberglass and Thermos-retractile Rubber • All products are manufactured in Brazil<br />
      MATERIAL FOR EDUCATIONAL PURPOSES ONLY<br /><br />
      All products are manufactured by the sender: Pro Delphus Simuladores Cirúrgicos.<br />
      All items are dolls made of rubber and/ or fiberglass in the shape of human organs.
    </div>
  </div>

  <footer>
    ${escapeHtml(COMPANY.cnpj)} &nbsp;&nbsp; ${escapeHtml(COMPANY.phone)}<br />
    ${escapeHtml(COMPANY.addressLine1)} / ${escapeHtml(COMPANY.addressLine2)}
  </footer>
</body>
</html>`
}

function renderPackingListBoxHtml(data: PackingListBoxData) {
  const itemLines = data.items
    .map((item) => `<div class="pl-item">${String(item.quantity).padStart(2, '0')} pc | ${escapeHtml(item.title)}</div>`)
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 48px; font-size: 13px; }
  .warning-box { border: 3px solid #1a1a1a; padding: 18px; text-align: center; font-size: 20px; font-weight: 800; line-height: 1.4; margin-bottom: 28px; }
  .block { margin-bottom: 22px; }
  .block h3 { font-size: 12px; font-weight: 800; text-transform: uppercase; margin: 0 0 6px; border-bottom: 2px solid #1a1a1a; padding-bottom: 3px; }
  .block p { margin: 0; line-height: 1.6; font-size: 12.5px; white-space: pre-line; }
  .pl-title { font-size: 14px; font-weight: 800; margin-bottom: 6px; }
  .pl-item { font-size: 12.5px; padding: 2px 0; }
  .disclaimer { margin-top: 28px; text-align: center; font-size: 10.5px; line-height: 1.8; color: #ef1818; font-weight: 600; }
  .disclaimer .tags { margin-top: 8px; font-weight: 800; letter-spacing: 0.5px; }
</style>
</head>
<body>
  <div class="warning-box">DO NOT ACCEPT DELIVERY IF THE BOX<br />IS OPENED OR DAMAGED</div>

  <div class="block">
    <h3>Addressee</h3>
    <p>${nl2br(data.shipToText)}</p>
  </div>

  <div class="block">
    <h3>Sender</h3>
    <p>Pro Delphus Simuladores Cirúrgicos
Rua Professor Alfeu Rabelo, 169 - Casa Caiada
Olinda/PE - Brazil - 53130-420
Phone: +55 (81) 3432.7702</p>
  </div>

  <div class="block">
    <div class="pl-title">Packing List (${data.orderNumber})</div>
    ${itemLines}
  </div>

  <div class="disclaimer">
    Dummies made of thermos-retractable rubber in the shape of a human organ/body part.<br />
    There are no biological components in this material.<br />
    MATERIAL FOR EDUCATIONAL PURPOSES (MEDICAL SIMULATION)
    <div class="tags">NON HAZARDOUS MATERIAL &nbsp;·&nbsp; NON PERISHABLE ITEM &nbsp;·&nbsp; NON-ORGANIC &nbsp;·&nbsp; NON-RADIOACTIVE</div>
  </div>
</body>
</html>`
}

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null

async function getBrowser() {
  browserPromise ??= puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  return browserPromise
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0' } })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function generateInvoicePdf(data: OrderDocData): Promise<Buffer> {
  return renderPdf(renderInvoiceLikeHtml(data, 'invoice'))
}

export async function generatePackingListPdf(data: OrderDocData): Promise<Buffer> {
  return renderPdf(renderInvoiceLikeHtml(data, 'packing-list'))
}

export async function generatePackingListBoxPdf(data: PackingListBoxData): Promise<Buffer> {
  return renderPdf(renderPackingListBoxHtml(data))
}
