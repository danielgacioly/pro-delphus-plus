import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { clientPrefixLabel } from '@prodelphusplus/shared'
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
  title: string
  description: string
  quantity: number
  /** Preço de catálogo. Null quando o produto não tinha preço na moeda do orçamento. */
  listPrice: number | null
  /** Preço cobrado — igual ao de catálogo, salvo quando houve preço especial. */
  unitPrice: number
  lineTotal: number
  photoDataUri: string | null
}

/**
 * Um item tem preço especial só quando o cobrado é MENOR que o de tabela — é a
 * situação de desconto negociado, que vale a pena destacar riscando o preço de
 * catálogo. Um preço customizado MAIOR não é "especial", é só o preço daquele
 * item: some direto na coluna normal, sem riscado e sem entrar na coluna de
 * preço especial. A coluna só existe no documento se pelo menos um item
 * estiver na condição de desconto — orçamento sem negociação sai idêntico ao
 * de antes, sem coluna vazia sobrando.
 */
function hasSpecialPrice(item: QuotePdfItem) {
  return item.listPrice !== null && item.unitPrice < item.listPrice
}

export interface QuotePdfSignature {
  name: string
  jobTitle: string | null
  phone: string | null
  whatsapp: string | null
  email: string
  signatureImageDataUri: string | null
}

// Ícones (glifo simplificado em traço, estilo Feather) na frente de cada
// linha de contato da assinatura automática — cor herda do texto ao redor
// via currentColor, pra acompanhar o `.sig-contact` claro sobre o fundo
// escuro da assinatura.
function contactIcon(innerSvg: string) {
  return `<svg class="sig-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${innerSvg}</svg>`
}

const PHONE_ICON_SVG = contactIcon(
  '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>',
)
const WHATSAPP_ICON_SVG = contactIcon(
  '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
)
const MAIL_ICON_SVG = contactIcon(
  '<path d="M4 4h16c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>',
)
const GLOBE_ICON_SVG = contactIcon(
  '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
)
const INSTAGRAM_ICON_SVG = contactIcon(
  '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>',
)
const COMPANY_INSTAGRAM = '@prodelphus_simuladores'

export interface QuotePdfData {
  quoteNumber: string
  language: QuoteLanguage
  clientPrefix: 'NONE' | 'MR' | 'MS'
  clientName: string
  /** País do cliente vinculado — decide Sr./Sra. vs Mr./Ms., ver clientPrefixLabel. */
  clientCountry: string | null
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

function renderItemDescription(item: QuotePdfItem) {
  const title = `<strong>${escapeHtml(item.title)}</strong>`
  const description = item.description.trim()
  if (!description) return title
  return `${title} - ${escapeHtml(description).replace(/\n/g, '<br />')}`
}

function renderHtml(data: QuotePdfData) {
  const t = LABELS[data.language]
  const money = (value: number) => formatMoney(value, data.currency, data.language)

  const showSpecial = data.items.some(hasSpecialPrice)

  const rows = data.items
    .map(
      (item, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td class="num">${item.quantity}</td>
          <td>${renderItemDescription(item)}</td>
          <td class="photo-cell">${
            item.photoDataUri ? `<img src="${item.photoDataUri}" alt="" />` : ''
          }</td>
          <td class="num${hasSpecialPrice(item) ? ' struck' : ''}">${
            item.listPrice === null ? '—' : money(hasSpecialPrice(item) ? item.listPrice : item.unitPrice)
          }</td>
          ${
            showSpecial
              ? `<td class="num special-cell">${hasSpecialPrice(item) || item.listPrice === null ? money(item.unitPrice) : '—'}</td>`
              : ''
          }
          <td class="num total-cell">${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('')

  const prefix = clientPrefixLabel(data.clientPrefix, data.clientCountry, data.language)
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
  table.items .special-cell { color: #ef1818; font-weight: 700; }
  table.items .struck { color: #8a8a8a; text-decoration: line-through; }
  .photo-cell { text-align: center; width: 64px; }
  .photo-cell img { max-width: 56px; max-height: 56px; object-fit: contain; }
  .summary { display: flex; margin-top: 0; border: 1px solid #e5e3da; border-top: none; }
  .notes-box { flex: 1; padding: 12px 14px; font-size: 10.5px; color: #4a4a4a; line-height: 1.6; border-right: 1px solid #e5e3da; }
  .totals-box { width: 230px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12px; font-weight: 700; color: #ef1818; border-bottom: 1px solid #e5e3da; }
  .totals-row span:first-child { color: #1a1a1a; }
  .totals-row.grand { font-size: 15px; border-bottom: none; }
  .signature { margin-top: 40px; display: flex; align-items: stretch; border-radius: 6px; overflow: hidden; border: 1px solid #e5e3da; }
  .signature .sig-logo { background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 10px 20px; }
  .signature .sig-logo img { width: 104px; height: auto; }
  .signature .sig-signature { flex: 1; background: #ffffff; display: flex; align-items: center; padding: 10px 24px; }
  .signature .sig-signature img { max-width: 260px; max-height: 80px; }
  .signature .sig-bar { flex: 1; background: #1a1a1a; color: #ffffff; padding: 12px 20px 12px 24px; display: flex; flex-direction: column; justify-content: center; gap: 2px; border-left: 8px solid #ef1818; }
  .signature .sig-name { font-size: 14px; font-weight: 700; }
  .signature .sig-role { font-size: 10.5px; color: #c9c9c9; margin-bottom: 6px; }
  .signature .sig-contact { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #f2f2f2; }
  .signature .sig-icon { flex-shrink: 0; }
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
        ${showSpecial ? `<th class="num">${t.specialPrice}</th>` : ''}
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
    ${
      data.signature.signatureImageDataUri
        ? `<div class="sig-signature"><img src="${data.signature.signatureImageDataUri}" alt="" /></div>`
        : `<div class="sig-logo"><img src="${logoDataUri}" alt="Pro Delphus" /></div>
    <div class="sig-bar">
      <div class="sig-name">${escapeHtml(data.signature.name)}</div>
      <div class="sig-role">${escapeHtml(data.signature.jobTitle ?? t.defaultJobTitle)}</div>
      ${data.signature.phone ? `<div class="sig-contact">${PHONE_ICON_SVG}${escapeHtml(data.signature.phone)}</div>` : ''}
      ${data.signature.whatsapp ? `<div class="sig-contact">${WHATSAPP_ICON_SVG}${escapeHtml(data.signature.whatsapp)}</div>` : ''}
      <div class="sig-contact">${MAIL_ICON_SVG}${escapeHtml(data.signature.email)}</div>
      <div class="sig-contact">${GLOBE_ICON_SVG}${escapeHtml(COMPANY.website)}</div>
      <div class="sig-contact">${INSTAGRAM_ICON_SVG}${escapeHtml(COMPANY_INSTAGRAM)}</div>
    </div>`
    }
  </div>
</body>
</html>`
}

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null

async function getBrowser() {
  // O Chromium do Debian (instalado via apt no Dockerfile) tenta subir o
  // crash_reporter/crashpad_handler ao iniciar e falha em alguns hosts com
  // "chrome_crashpad_handler: --database is required", derrubando o launch
  // inteiro antes mesmo de renderizar qualquer página. Desabilitar o crash
  // reporter evita que esse subprocesso seja disparado.
  browserPromise ??= puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-crash-reporter'] })
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
