import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { LABELS, type QuoteLanguage } from './quoteI18n.js'
import { COMPANY } from './pdf.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoBuffer = fs.readFileSync(path.join(__dirname, '../assets/logo-company.png'))

export interface QuoteXlsxItem {
  title: string
  description: string
  quantity: number
  unitPrice: number
}

export interface QuoteXlsxSignature {
  name: string
  jobTitle: string | null
  phone: string | null
  email: string
  signatureImageDataUri: string | null
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
  subtotal: number
  total: number
  currency: string
  signature: QuoteXlsxSignature
}

const RED = 'FFEF1818'
const INK = 'FF1A1A1A'
const HEADER_FILL = 'FFF1EFE9'
const BORDER_COLOR = 'FFE5E3DA'
const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
}

export async function generateQuoteXlsx(data: QuoteXlsxData): Promise<Buffer> {
  const t = LABELS[data.language]

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(t.quote, { views: [{ showGridLines: false }] })

  sheet.columns = [
    { width: 6 },
    { width: 8 },
    { width: 52 },
    { width: 18 },
    { width: 18 },
  ]

  const logoImageId = workbook.addImage({ buffer: logoBuffer as any, extension: 'png' })
  sheet.addImage(logoImageId, { tl: { col: 0, row: 0.1 }, ext: { width: 70, height: 57 } })

  sheet.mergeCells('B1:C1')
  sheet.getCell('B1').value = COMPANY.name
  sheet.getCell('B1').font = { bold: true, size: 13, color: { argb: INK } }

  sheet.mergeCells('B2:C2')
  sheet.getCell('B2').value = COMPANY.cnpj
  sheet.mergeCells('B3:C3')
  sheet.getCell('B3').value = COMPANY.addressLine1
  sheet.mergeCells('B4:C4')
  sheet.getCell('B4').value = `${COMPANY.addressLine2}  ·  ${COMPANY.phone}`
  ;['B2', 'B3', 'B4'].forEach((ref) => {
    sheet.getCell(ref).font = { size: 9, color: { argb: 'FF4A4A4A' } }
  })

  sheet.mergeCells('D1:E1')
  const titleCell = sheet.getCell('D1')
  titleCell.value = t.quote
  titleCell.font = { bold: true, size: 22, color: { argb: INK } }
  titleCell.alignment = { horizontal: 'right' }

  sheet.mergeCells('D2:E2')
  const numberCell = sheet.getCell('D2')
  numberCell.value = `#${data.quoteNumber}`
  numberCell.font = { bold: true, size: 12, color: { argb: INK } }
  numberCell.alignment = { horizontal: 'right' }

  const prefix = t.prefix[data.clientPrefix]
  sheet.mergeCells('A6:E6')
  const toCell = sheet.getCell('A6')
  toCell.value = `${t.to}: ${[prefix, data.clientName].filter(Boolean).join(' ')}`
  toCell.font = { bold: true, size: 12, color: { argb: INK } }

  const headerRowIndex = 8
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = [t.item, t.qty, t.description, t.unitPrice, t.total]
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: INK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = thinBorder
    cell.alignment = { vertical: 'middle' }
  })

  data.items.forEach((item, index) => {
    const rowIndex = headerRowIndex + 1 + index
    const row = sheet.getRow(rowIndex)
    row.values = [index + 1, item.quantity, '', item.unitPrice, { formula: `D${rowIndex}*B${rowIndex}` }]
    const description = item.description.trim()
    row.getCell(3).value = {
      richText: [
        { text: item.title, font: { bold: true, color: { argb: INK } } },
        ...(description ? [{ text: ` - ${description}`, font: { color: { argb: INK } } }] : []),
      ],
    }
    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(2).alignment = { horizontal: 'center' }
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' }
    row.getCell(4).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(5).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(5).font = { color: { argb: RED }, bold: true }
    row.eachCell((cell) => (cell.border = thinBorder))
  })

  const lastItemRow = headerRowIndex + data.items.length
  const summaryTop = lastItemRow + 1

  if (data.notes) {
    sheet.mergeCells(`A${summaryTop}:C${summaryTop + 5}`)
    const notesCell = sheet.getCell(`A${summaryTop}`)
    notesCell.value = data.notes
    notesCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    notesCell.font = { size: 9, color: { argb: 'FF4A4A4A' } }
    notesCell.border = thinBorder
  }

  let row = summaryTop
  sheet.mergeCells(`D${row}:D${row}`)
  sheet.getCell(`D${row}`).value = t.shipping
  sheet.getCell(`D${row}`).font = { bold: true, color: { argb: INK } }
  sheet.getCell(`D${row}`).border = thinBorder
  sheet.getCell(`E${row}`).value = data.freight ?? t.toBeDefined
  if (data.freight !== null) sheet.getCell(`E${row}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`E${row}`).font = { bold: true, color: { argb: RED } }
  sheet.getCell(`E${row}`).border = thinBorder
  const freightRow = row
  row++

  let discountRow: number | null = null
  if (data.discount > 0) {
    sheet.getCell(`D${row}`).value = t.discount
    sheet.getCell(`D${row}`).font = { bold: true, color: { argb: INK } }
    sheet.getCell(`D${row}`).border = thinBorder
    sheet.getCell(`E${row}`).value = -data.discount
    sheet.getCell(`E${row}`).numFmt = `"${data.currency}" #,##0.00`
    sheet.getCell(`E${row}`).font = { bold: true, color: { argb: RED } }
    sheet.getCell(`E${row}`).border = thinBorder
    discountRow = row
    row++
  }

  sheet.getCell(`D${row}`).value = t.total
  sheet.getCell(`D${row}`).font = { bold: true, size: 12, color: { argb: INK } }
  sheet.getCell(`D${row}`).border = thinBorder
  const freightRef = data.freight !== null ? `E${freightRow}` : '0'
  const discountRef = discountRow ? `+E${discountRow}` : ''
  sheet.getCell(`E${row}`).value = {
    formula: `SUM(E${headerRowIndex + 1}:E${lastItemRow})+${freightRef}${discountRef}`,
  }
  sheet.getCell(`E${row}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`E${row}`).font = { bold: true, size: 12, color: { argb: RED } }
  sheet.getCell(`E${row}`).border = thinBorder

  const sigTop = Math.max(row + 3, summaryTop + 7)
  // A plain top border (not a merge) draws the same divider line without
  // clobbering the independent name/role/contact values written below —
  // merging A:E across every row here previously made every write share
  // one cell, so only the last line (the email) ever survived.
  ;['A', 'B', 'C', 'D', 'E'].forEach((col) => {
    sheet.getCell(`${col}${sigTop}`).border = { top: { style: 'thin', color: { argb: BORDER_COLOR } } }
  })

  if (data.signature.signatureImageDataUri) {
    // Own signature replaces the company logo + text block entirely.
    const base64 = data.signature.signatureImageDataUri.split(',')[1] ?? ''
    const ext = data.signature.signatureImageDataUri.includes('image/png') ? 'png' : 'jpeg'
    const sigImageId = workbook.addImage({ base64, extension: ext as 'png' | 'jpeg' })
    sheet.addImage(sigImageId, { tl: { col: 0.2, row: sigTop - 1 + 0.3 }, ext: { width: 180, height: 70 } })
  } else {
    const sigLogoImageId = workbook.addImage({ buffer: logoBuffer as any, extension: 'png' })
    sheet.addImage(sigLogoImageId, { tl: { col: 0.2, row: sigTop - 1 + 0.3 }, ext: { width: 55, height: 45 } })

    const nameCell = sheet.getCell(`B${sigTop}`)
    nameCell.value = data.signature.name
    nameCell.font = { bold: true, size: 11, color: { argb: INK } }

    const roleCell = sheet.getCell(`B${sigTop + 1}`)
    roleCell.value = data.signature.jobTitle ?? 'Sales Assistant'
    roleCell.font = { size: 9, color: { argb: 'FF6A6A6A' } }

    const contactLines = [data.signature.phone, data.signature.email, COMPANY.website].filter(Boolean)
    contactLines.forEach((line, i) => {
      const cell = sheet.getCell(`B${sigTop + 2 + i}`)
      cell.value = line ?? ''
      cell.font = { size: 9, color: { argb: 'FF4A4A4A' } }
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
