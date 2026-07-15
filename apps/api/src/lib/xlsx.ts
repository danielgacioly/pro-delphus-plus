import ExcelJS from 'exceljs'
import { LABELS, type QuoteLanguage } from './quoteI18n.js'
import { COMPANY } from './pdf.js'

export interface QuoteXlsxItem {
  sku: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface QuoteXlsxData {
  quoteNumber: string
  language: QuoteLanguage
  clientPrefix: 'NONE' | 'MR' | 'MS'
  clientName: string
  notes: string | null
  items: QuoteXlsxItem[]
  freight: number | null
  discount: number
  currency: string
}

const BRAND_RED = 'FFEF1818'
const HEADER_FILL = 'FFF1EFE9'

export async function generateQuoteXlsx(data: QuoteXlsxData): Promise<Buffer> {
  const t = LABELS[data.language]
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(t.quote)

  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 45 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
  ]

  sheet.mergeCells('A1:F1')
  sheet.getCell('A1').value = COMPANY.name
  sheet.getCell('A1').font = { bold: true, size: 14 }

  sheet.mergeCells('A2:F2')
  sheet.getCell('A2').value = `${t.quote} #${data.quoteNumber}`
  sheet.getCell('A2').font = { bold: true, size: 12, color: { argb: BRAND_RED } }

  const prefix = t.prefix[data.clientPrefix]
  sheet.mergeCells('A3:F3')
  sheet.getCell('A3').value = `${t.to}: ${[prefix, data.clientName].filter(Boolean).join(' ')}`
  sheet.getCell('A3').font = { bold: true }

  const headerRowIndex = 5
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = [t.item, 'SKU', t.description, t.qty, t.unitPrice, t.total]
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  })

  data.items.forEach((item, index) => {
    const rowIndex = headerRowIndex + 1 + index
    const row = sheet.getRow(rowIndex)
    row.values = [index + 1, item.sku, item.productName, item.quantity, item.unitPrice, { formula: `D${rowIndex}*E${rowIndex}` }]
    row.getCell(5).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(6).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(6).font = { color: { argb: BRAND_RED }, bold: true }
    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
  })

  const lastItemRow = headerRowIndex + data.items.length
  let cursor = lastItemRow + 2

  if (data.notes) {
    sheet.mergeCells(`A${cursor}:C${cursor + 4}`)
    const notesCell = sheet.getCell(`A${cursor}`)
    notesCell.value = data.notes
    notesCell.alignment = { wrapText: true, vertical: 'top' }
    notesCell.font = { size: 9, color: { argb: 'FF4A4A4A' } }
  }

  const summaryStartRow = cursor
  sheet.getCell(`E${summaryStartRow}`).value = t.shipping
  sheet.getCell(`F${summaryStartRow}`).value = data.freight ?? t.toBeDefined
  if (data.freight !== null) sheet.getCell(`F${summaryStartRow}`).numFmt = `"${data.currency}" #,##0.00`
  cursor++

  if (data.discount > 0) {
    sheet.getCell(`E${cursor}`).value = t.discount
    sheet.getCell(`F${cursor}`).value = -data.discount
    sheet.getCell(`F${cursor}`).numFmt = `"${data.currency}" #,##0.00`
    cursor++
  }

  sheet.getCell(`E${cursor}`).value = t.total
  sheet.getCell(`E${cursor}`).font = { bold: true }
  const freightRef = data.freight !== null ? `F${summaryStartRow}` : '0'
  const discountRef = data.discount > 0 ? `+F${cursor - 1}` : ''
  sheet.getCell(`F${cursor}`).value = {
    formula: `SUM(F${headerRowIndex + 1}:F${lastItemRow})+${freightRef}${discountRef}`,
  }
  sheet.getCell(`F${cursor}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`F${cursor}`).font = { bold: true, color: { argb: BRAND_RED } }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
