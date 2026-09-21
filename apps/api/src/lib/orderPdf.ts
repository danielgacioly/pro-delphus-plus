import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatOrderNumber } from '@prodelphusplus/shared'
import type { PackingListBoxPage } from '../domain/packaging.js'
import { COMPANY } from './pdf.js'
import { escapeHtml, nl2br } from './html.js'
import { renderPdf as renderPdfWithBrowser } from './browser.js'

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
  discount: number | null
  paypalFee: number | null
  total: number
  billToText: string
  shipToText: string
  numberOfPackages: string | null
  netWeightKg: string | null
  grossWeightKg: string | null
  awbNumber: string | null
  incoterms: string | null
  /** Só pra nacional — mostrado no lugar de Incoterms/AWB, que são coisa de exportação. */
  shippingMethod: string | null
  prepaymentBy: 'PAYPAL' | 'WIRE_TRANSFER' | 'PIX'
  nfDate: Date | null
  nfNumber: string | null
  /** Nacional = documento em português, moeda sempre BRL. */
  isNational: boolean
}

// O formato da página é decidido pela regra de divisão em caixas, não pelo
// renderizador — ver domain/packaging.ts.
export type { PackingListBoxItem, PackingListBoxPage } from '../domain/packaging.js'

export interface PackingListBoxData {
  orderNumber: number
  shipToText: string
  pages: PackingListBoxPage[]
  /** Nacional = documento em português, com o código NCM por item (exigido em documentos de venda doméstica). */
  isNational: boolean
  /** "PAC", "SEDEX", "Transportadora XPTO"... impresso como "VIA ___" no topo, só quando preenchido. */
  shippingMethod: string | null
}

// Símbolo de cada moeda do catálogo — sem isto, todo valor saía com "$" na
// frente mesmo em pedido nacional em Reais ou internacional em Euro.
const CURRENCY_SYMBOL: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }

function fmtMoney(value: number, currency: string) {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${symbol} ${formatted}`
}

function fmtDate(date: Date, isNational: boolean) {
  return isNational
    ? date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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

// Invoice/Packing List (o modelo "estilo invoice", não a Packing List Box)
// saíam sempre em inglês, mesmo em pedido nacional — ver o pedido original.
// Internacional continua em inglês (o idioma do orçamento internacional é
// sempre EN/ES, nunca vira este documento); nacional é sempre PT.
const INVOICE_LABELS = {
  EN: {
    invoiceTitle: 'INVOICE',
    packingListTitle: 'PACKING LIST',
    date: 'Date',
    po: 'Purchase Order #',
    orderedBy: 'Ordered By',
    itemDescription: 'ITEM DESCRIPTION',
    qty: 'QTY.',
    price: 'PRICE',
    totalPrice: 'TOTAL PRICE',
    shipping: 'Shipping',
    paypalFee: 'PayPal fee',
    discount: 'Discount',
    total: 'TOTAL',
    billTo: 'BILL TO',
    shipTo: 'SHIP TO',
    numberOfPackages: 'Number of Packages',
    netWeight: 'Net Weight',
    grossWeight: 'Gross Weight',
    awb: 'AWB #',
    incoterms: 'Incoterms',
    shippingMethod: 'Shipping Method',
    paymentDetails: 'PAYMENT DETAILS',
    paymentTerms: 'Payment Terms',
    prepaymentBy: 'Prepayment by',
    currency: 'Currency',
    wireTransfer: 'Wire Transfer',
    paypal: 'PayPal',
    pix: 'Pix',
    bankName: 'Bank Name',
    bankNumber: 'Bank Number',
    branch: 'Branch',
    accountNumber: 'Account Number',
    swiftCode: 'Swift Code',
    ibanCode: 'IBAN Code',
    beneficiaryName: 'Beneficiary Name',
    beneficiaryCode: 'Beneficiary Code',
    additionalInfo: 'ADDITIONAL INFORMATION',
    nfDate: 'Date',
    nfNumber: 'Sales Receipt Number',
    ncm: 'NCM/HS',
    disclaimer1: 'Made of Fiberglass and Thermos-retractile Rubber • All products are manufactured in Brazil',
    disclaimer2: 'MATERIAL FOR EDUCATIONAL PURPOSES ONLY',
    disclaimer3: 'All products are manufactured by the sender: Pro Delphus Simuladores Cirúrgicos.',
    disclaimer4: 'All items are dolls made of rubber and/ or fiberglass in the shape of human organs.',
  },
  PT: {
    invoiceTitle: 'FATURA',
    packingListTitle: 'PACKING LIST',
    date: 'Data',
    po: 'Pedido de Compra #',
    orderedBy: 'E-mail do Comprador',
    itemDescription: 'DESCRIÇÃO DO ITEM',
    qty: 'QTD.',
    price: 'PREÇO',
    totalPrice: 'PREÇO TOTAL',
    shipping: 'Frete',
    paypalFee: 'Taxa do PayPal',
    discount: 'Desconto',
    total: 'TOTAL',
    billTo: 'FATURAMENTO',
    shipTo: 'ENTREGA',
    numberOfPackages: 'Nº de Volumes',
    netWeight: 'Peso Líquido',
    grossWeight: 'Peso Bruto',
    awb: 'AWB #',
    incoterms: 'Incoterms',
    shippingMethod: 'Via de Envio',
    paymentDetails: 'DADOS DE PAGAMENTO',
    paymentTerms: 'Forma de Pagamento',
    prepaymentBy: 'Pagamento antecipado via',
    currency: 'Moeda',
    wireTransfer: 'Transferência Bancária',
    paypal: 'PayPal',
    pix: 'Pix',
    bankName: 'Banco',
    bankNumber: 'Código do Banco',
    branch: 'Agência',
    accountNumber: 'Conta',
    swiftCode: 'Swift Code',
    ibanCode: 'IBAN Code',
    beneficiaryName: 'Nome do Beneficiário',
    beneficiaryCode: 'CNPJ do Beneficiário',
    additionalInfo: 'INFORMAÇÕES ADICIONAIS',
    nfDate: 'Data',
    nfNumber: 'Número da Nota Fiscal',
    ncm: 'NCM',
    disclaimer1: 'Fabricado em Fibra de Vidro e Borracha Termo-retrátil • Todos os produtos são fabricados no Brasil',
    disclaimer2: 'MATERIAL EXCLUSIVO PARA FINS EDUCACIONAIS',
    disclaimer3: 'Todos os produtos são fabricados pelo remetente: Pro Delphus Simuladores Cirúrgicos.',
    disclaimer4: 'Todos os itens são bonecos feitos de borracha e/ou fibra de vidro em formato de órgãos humanos.',
  },
} as const

// Aplicado só na Packing List (não no Invoice) — pedido explícito de deixar
// a fonte bem maior pra facilitar a leitura de quem confere a carga.
const PACKING_LIST_FONT_BOOST = `
  body { font-size: 14px; }
  .doc-title { font-size: 28px; }
  .doc-number { font-size: 17px; }
  .doc-meta .row-value { font-size: 13px; }
  table.items thead th { font-size: 13px; }
  table.items td { font-size: 14px; }
  .item-desc { font-size: 12.5px; }
  .info-col h3, .info-side .cell b { font-size: 10.5px; }
  .info-col .body, .info-side .cell { font-size: 13px; }
`

const RED = '#ef1818'
const INK = '#1a1a1a'
const MUTED = '#6a6a6a'
const BORDER = '#c7c4ba'
const PANEL_BG = '#dedad0'

const SHARED_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${INK}; margin: 0; padding: 22px 40px; font-size: 10.5px; line-height: 1.3; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .company { display: flex; align-items: center; gap: 12px; }
  .company .logo img { width: 52px; height: auto; display: block; }
  .company-name { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
  .company-meta { font-size: 8.5px; color: ${MUTED}; line-height: 1.35; }
  .doc-meta { border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; min-width: 210px; }
  .doc-meta .row { padding: 5px 12px; border-top: 1px solid ${BORDER}; text-align: right; }
  .doc-meta .row:first-child { border-top: none; }
  .doc-meta .row-label { font-size: 7.5px; font-weight: 700; letter-spacing: 0.4px; color: ${MUTED}; text-transform: uppercase; display: block; margin-bottom: 1px; }
  .doc-meta .row-value { font-size: 10.5px; font-weight: 600; }
  .title-row { display: flex; align-items: baseline; gap: 14px; margin: 0 0 8px; }
  .doc-title { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; border-bottom: 3px solid ${RED}; padding-bottom: 2px; }
  .doc-number { border: 1.5px solid ${INK}; border-radius: 6px; padding: 3px 14px; font-size: 14px; font-weight: 800; }
  table.items { width: 100%; border-collapse: collapse; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
  table.items thead th { font-size: 9px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; padding: 5px 12px; text-align: left; }
  table.items thead .desc-head { background: ${RED}; color: #ffffff; }
  table.items thead .num-head { background: ${PANEL_BG}; color: ${INK}; text-align: center; }
  table.items td { border-top: 1px solid ${BORDER}; padding: 6px 12px; vertical-align: top; font-size: 10px; }
  table.items td.num { text-align: center; white-space: nowrap; vertical-align: middle; font-variant-numeric: tabular-nums; }
  .item-desc { color: #444; font-size: 9px; font-style: italic; display: block; margin-top: 1px; }
  .extra-row td { color: ${MUTED}; }
  .extra-row.discount-row td { color: ${RED}; font-weight: 700; }
  .total-bar { display: flex; justify-content: flex-end; align-items: center; gap: 14px; border: 1px solid ${BORDER}; border-radius: 8px; padding: 8px 14px; margin: -6px 0 14px; background: ${PANEL_BG}; }
  .total-bar .label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.3px; }
  .total-bar .value { font-size: 14px; font-weight: 800; color: ${RED}; }
  .info-grid { display: flex; gap: 12px; margin-bottom: 10px; align-items: stretch; }
  .info-col { flex: 1; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; }
  .info-col h3 { margin: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.4px; text-align: left; background: ${PANEL_BG}; padding: 5px 12px; border-bottom: 1px solid ${BORDER}; }
  .info-col .body { padding: 7px 12px; font-size: 9.5px; line-height: 1.4; }
  .info-side { width: 180px; border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .info-side .cell { padding: 4px 12px; border-top: 1px solid ${BORDER}; font-size: 9px; }
  .info-side .cell:first-child { border-top: none; }
  .info-side .cell b { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.3px; color: ${MUTED}; text-transform: uppercase; margin-bottom: 0; }
  .section { border: 1px solid ${BORDER}; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
  .section-title { background: ${PANEL_BG}; font-weight: 700; font-size: 9.5px; letter-spacing: 0.4px; padding: 5px 12px; border-bottom: 1px solid ${BORDER}; }
  .payment-grid { display: flex; border-bottom: 1px solid ${BORDER}; }
  .payment-grid:last-child { border-bottom: none; }
  .payment-grid .cell { flex: 1; padding: 5px 12px; font-size: 9px; border-right: 1px solid ${BORDER}; }
  .payment-grid .cell:last-child { border-right: none; }
  .payment-grid .cell b { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.3px; color: ${MUTED}; text-transform: uppercase; margin-bottom: 0; }
  .additional-grid { display: flex; border-bottom: 1px solid ${BORDER}; }
  .additional-grid .cell { flex: 1; padding: 5px 12px; font-size: 9px; border-right: 1px solid ${BORDER}; }
  .additional-grid .cell:last-child { border-right: none; }
  .additional-grid .cell b { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.3px; color: ${MUTED}; text-transform: uppercase; margin-bottom: 0; }
  .additional { padding: 8px 14px; font-size: 8.5px; text-align: center; line-height: 1.5; color: #444; }
  footer { margin-top: 5px; text-align: center; font-size: 8px; color: ${MUTED}; }
`

function prepaymentLabel(t: (typeof INVOICE_LABELS)[keyof typeof INVOICE_LABELS], method: OrderDocData['prepaymentBy']) {
  if (method === 'PAYPAL') return t.paypal
  if (method === 'PIX') return t.pix
  return t.wireTransfer
}

function renderInvoiceLikeHtml(data: OrderDocData, mode: 'invoice' | 'packing-list') {
  const isInvoice = mode === 'invoice'
  const t = INVOICE_LABELS[data.isNational ? 'PT' : 'EN']
  const title = isInvoice ? t.invoiceTitle : t.packingListTitle
  // Pix não tem taxa nem dado bancário (usa chave, que não é um campo do
  // sistema) — some a seção bancária inteira. Swift/IBAN são só pra
  // transferência internacional, então nem aparecem em pedido nacional.
  const showBankBlock = data.prepaymentBy !== 'PIX'
  const showSwiftIban = showBankBlock && !data.isNational

  const rows = data.items
    .map(
      (item) => `
        <tr>
          <td>${renderItemDescription(item)}</td>
          <td class="num">${item.quantity}</td>
          ${isInvoice ? `<td class="num">${fmtMoney(item.unitPrice, data.currency)}</td><td class="num">${fmtMoney(item.lineTotal, data.currency)}</td>` : ''}
        </tr>`,
    )
    .join('')

  const extraRowCols = 3
  const extraRows = isInvoice
    ? [
        data.freight !== null
          ? `<tr class="extra-row"><td colspan="${extraRowCols}">${t.shipping}</td><td class="num">${fmtMoney(data.freight, data.currency)}</td></tr>`
          : '',
        data.paypalFee !== null
          ? `<tr class="extra-row"><td colspan="${extraRowCols}">${t.paypalFee}</td><td class="num">${fmtMoney(data.paypalFee, data.currency)}</td></tr>`
          : '',
        data.discount !== null && data.discount > 0
          ? `<tr class="extra-row discount-row"><td colspan="${extraRowCols}">${t.discount}</td><td class="num">-${fmtMoney(data.discount, data.currency)}</td></tr>`
          : '',
      ].join('')
    : ''

  return `<!doctype html>
<html lang="${data.isNational ? 'pt' : 'en'}">
<head>
<meta charset="utf-8" />
<style>${SHARED_STYLE}${isInvoice ? '' : PACKING_LIST_FONT_BOOST}</style>
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
      <div class="row"><span class="row-label">${t.date}</span><span class="row-value">${escapeHtml(fmtDate(data.invoiceDate, data.isNational))}</span></div>
      <div class="row"><span class="row-label">${t.po}</span><span class="row-value">${escapeHtml(data.purchaseOrder)}</span></div>
      <div class="row"><span class="row-label">${t.orderedBy}</span><span class="row-value">${escapeHtml(data.orderedByEmail)}</span></div>
    </div>
  </header>

  <div class="title-row">
    <div class="doc-title">${title}</div>
    <div class="doc-number">${formatOrderNumber(data.orderNumber)}</div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="desc-head">${t.itemDescription}</th>
        <th class="num-head">${t.qty}</th>
        ${isInvoice ? `<th class="num-head">${t.price}</th><th class="num-head">${t.totalPrice}</th>` : ''}
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${extraRows}
    </tbody>
  </table>
  ${
    isInvoice
      ? `<div class="total-bar">
    <span class="label">${t.total}</span>
    <span class="value">${fmtMoney(data.total, data.currency)}</span>
  </div>`
      : ''
  }

  <div class="info-grid">
    <div class="info-col">
      <h3>${t.billTo}</h3>
      <div class="body">${nl2br(data.billToText)}</div>
    </div>
    <div class="info-col">
      <h3>${t.shipTo}</h3>
      <div class="body">${nl2br(data.shipToText)}</div>
    </div>
    <div class="info-side">
      <div class="cell"><b>${t.numberOfPackages}</b>${escapeHtml(data.numberOfPackages ?? '—')}</div>
      <div class="cell"><b>${t.netWeight}</b>${escapeHtml(data.netWeightKg ? `${data.netWeightKg} KG` : '—')}</div>
      <div class="cell"><b>${t.grossWeight}</b>${escapeHtml(data.grossWeightKg ? `${data.grossWeightKg} KG` : '—')}</div>
      ${
        data.isNational
          ? `<div class="cell"><b>${t.shippingMethod}</b>${escapeHtml(data.shippingMethod ?? '—')}</div>`
          : `<div class="cell"><b>${t.awb}</b>${escapeHtml(data.awbNumber ?? '—')}</div>
      <div class="cell"><b>${t.incoterms}</b>${escapeHtml(data.incoterms ?? '—')}</div>`
      }
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t.paymentDetails}</div>
    <div class="payment-grid">
      <div class="cell"><b>${t.paymentTerms}</b>${t.prepaymentBy} ${prepaymentLabel(t, data.prepaymentBy)}</div>
      <div class="cell"><b>${t.currency}</b>${escapeHtml(data.currency)}</div>
    </div>
    ${
      showBankBlock
        ? `<div class="payment-grid">
      <div class="cell"><b>${t.bankName}</b>${escapeHtml(BANK.name)}</div>
      <div class="cell"><b>${t.bankNumber}</b>${escapeHtml(BANK.number)}</div>
      <div class="cell"><b>${t.branch}</b>${escapeHtml(BANK.branch)}</div>
      <div class="cell"><b>${t.accountNumber}</b>${escapeHtml(BANK.account)}</div>
    </div>
    ${
      showSwiftIban
        ? `<div class="payment-grid">
      <div class="cell"><b>${t.swiftCode}</b>${escapeHtml(BANK.swift)}</div>
      <div class="cell"><b>${t.ibanCode}</b>${escapeHtml(BANK.iban)}</div>
    </div>`
        : ''
    }
    <div class="payment-grid">
      <div class="cell"><b>${t.beneficiaryName}</b>${escapeHtml(BANK.beneficiaryName)}</div>
      <div class="cell"><b>${t.beneficiaryCode}</b>${escapeHtml(BANK.beneficiaryCode)}</div>
    </div>`
        : ''
    }
  </div>

  <div class="section">
    <div class="section-title">${t.additionalInfo}</div>
    <div class="additional-grid">
      <div class="cell"><b>${t.nfDate}</b>${data.nfDate ? escapeHtml(fmtDateShort(data.nfDate)) : '—'}</div>
      <div class="cell"><b>${t.nfNumber}</b>${escapeHtml(data.nfNumber ?? '—')}</div>
      <div class="cell"><b>${t.ncm}</b>${NCM_HS_CODE}</div>
    </div>
    <div class="additional">
      ${escapeHtml(t.disclaimer1)}<br />
      ${escapeHtml(t.disclaimer2)}<br /><br />
      ${escapeHtml(t.disclaimer3)}<br />
      ${escapeHtml(t.disclaimer4)}
    </div>
  </div>

  <footer>
    ${escapeHtml(COMPANY.cnpj)} &nbsp;&nbsp; ${escapeHtml(COMPANY.phone)}<br />
    ${escapeHtml(COMPANY.addressLine1)} / ${escapeHtml(COMPANY.addressLine2)}
  </footer>
</body>
</html>`
}

// Nacional sai num modelo próprio (português + NCM por item), diferente do
// internacional — ver PackingListBoxData.isNational e o pedido original.
function renderPackingListBoxPage(data: PackingListBoxData, page: PackingListBoxPage, isLast: boolean) {
  const pageStyle = isLast ? '' : ' style="page-break-after: always;"'

  if (data.isNational) {
    const itemLines = page.items
      .map(
        (item) =>
          `<div class="pl-item">${String(item.quantity).padStart(2, '0')} PC| ${escapeHtml(item.title)}<br />(NCM: ${NCM_HS_CODE})</div>`,
      )
      .join('')

    return `<div class="box-page"${pageStyle}>
  ${data.shippingMethod ? `<div class="via-line">VIA ${escapeHtml(data.shippingMethod.toUpperCase())}</div>` : ''}
  <div class="warning-box">NÃO ACEITAR SE A EMBALAGEM ESTIVER<br />VIOLADA OU AMASSADA</div>

  <div class="block">
    <h3>Destinatário</h3>
    <p>${nl2br(data.shipToText)}</p>
  </div>

  <div class="block">
    <h3>Remetente</h3>
    <p>Pro Delphus Simuladores Cirúrgicos
Rua Professor Alfeu Rabelo, 169 - Casa Caiada
Olinda/PE - Brasil - CEP 53130-420
Fone: (81) 3432.7702</p>
  </div>

  <div class="block">
    <div class="pl-title">
      Packing List (${formatOrderNumber(data.orderNumber)})
      ${page.totalBoxes > 1 ? `<span class="box-label">Caixa ${page.boxNumber} de ${page.totalBoxes}</span>` : ''}
    </div>
    ${itemLines || '<div class="pl-item pl-empty">— nenhum item atribuído a esta caixa —</div>'}
  </div>

  <div class="disclaimer">
    Material Exclusivo Para Fins Educacionais
    <div class="tags">Não Perecível &nbsp;·&nbsp; Não Perigoso &nbsp;·&nbsp; Não Radioativo &nbsp;·&nbsp; Atóxico &nbsp;·&nbsp; Seguro Para Abrir &nbsp;·&nbsp; Não Contém Bateria</div>
  </div>
</div>`
  }

  const itemLines = page.items
    .map((item) => `<div class="pl-item">${String(item.quantity).padStart(2, '0')} pc | ${escapeHtml(item.title)}</div>`)
    .join('')

  return `<div class="box-page"${pageStyle}>
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
    <div class="pl-title">
      Packing List (${formatOrderNumber(data.orderNumber)})
      ${page.totalBoxes > 1 ? `<span class="box-label">Box ${page.boxNumber} of ${page.totalBoxes}</span>` : ''}
    </div>
    ${itemLines || '<div class="pl-item pl-empty">— no items assigned to this box —</div>'}
  </div>

  <div class="disclaimer">
    Dummies made of thermos-retractable rubber in the shape of a human organ/body part.<br />
    There are no biological components in this material.<br />
    MATERIAL FOR EDUCATIONAL PURPOSES (MEDICAL SIMULATION)
    <div class="tags">NON HAZARDOUS MATERIAL &nbsp;·&nbsp; NON PERISHABLE ITEM &nbsp;·&nbsp; NON-ORGANIC &nbsp;·&nbsp; NON-RADIOACTIVE</div>
  </div>
</div>`
}

function renderPackingListBoxHtml(data: PackingListBoxData) {
  const pages = data.pages.map((page, index) => renderPackingListBoxPage(data, page, index === data.pages.length - 1)).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  /* Fonte bem maior que o padrão do resto dos documentos — pedido explícito
     pra facilitar a leitura de quem confere a caixa no galpão/transportadora. */
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 17px; }
  .box-page { padding: 48px; }
  .via-line { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 1px; margin-bottom: 14px; }
  .warning-box { border: 3px solid #1a1a1a; padding: 20px; text-align: center; font-size: 25px; font-weight: 800; line-height: 1.4; margin-bottom: 30px; }
  .block { margin-bottom: 24px; }
  .block h3 { font-size: 15px; font-weight: 800; text-transform: uppercase; margin: 0 0 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; }
  .block p { margin: 0; line-height: 1.6; font-size: 17px; white-space: pre-line; }
  .pl-title { font-size: 19px; font-weight: 800; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
  .box-label { font-size: 14px; font-weight: 700; color: #ef1818; border: 1.5px solid #ef1818; border-radius: 5px; padding: 2px 10px; }
  .pl-item { font-size: 17px; padding: 3px 0; }
  .pl-empty { color: #888; font-style: italic; }
  .disclaimer { margin-top: 30px; text-align: center; font-size: 13.5px; line-height: 1.8; color: #ef1818; font-weight: 600; }
  .disclaimer .tags { margin-top: 8px; font-weight: 800; letter-spacing: 0.5px; }
</style>
</head>
<body>
${pages}
</body>
</html>`
}

async function renderPdf(html: string): Promise<Buffer> {
  return renderPdfWithBrowser(html, { format: 'A4', printBackground: true, margin: { top: '0', bottom: '0' } })
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
