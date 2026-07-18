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
  photoDataUri: string | null
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

function dataUriToImage(dataUri: string): { base64: string; extension: 'png' | 'jpeg' } {
  const base64 = dataUri.split(',')[1] ?? ''
  const extension = dataUri.includes('image/png') ? 'png' : 'jpeg'
  return { base64, extension }
}

export async function generateQuoteXlsx(data: QuoteXlsxData): Promise<Buffer> {
  const t = LABELS[data.language]

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(t.quote, { views: [{ showGridLines: false }] })

  // Column A is 10 chars (~75px) wide — just for the item-number cells, but
  // also wide enough to hold the 60px header/signature logo without it
  // spilling into column B and overlapping the company name/signature text.
  sheet.columns = [{ width: 10 }, { width: 8 }, { width: 44 }, { width: 10 }, { width: 18 }, { width: 18 }]

  const logoImageId = workbook.addImage({ buffer: logoBuffer as any, extension: 'png' })
  sheet.addImage(logoImageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 60, height: 49 } })

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

  sheet.mergeCells('E1:F1')
  const titleCell = sheet.getCell('E1')
  titleCell.value = t.quote
  titleCell.font = { bold: true, size: 22, color: { argb: INK } }
  titleCell.alignment = { horizontal: 'right' }

  sheet.mergeCells('E2:F2')
  const numberCell = sheet.getCell('E2')
  numberCell.value = `#${data.quoteNumber}`
  numberCell.font = { bold: true, size: 12, color: { argb: INK } }
  numberCell.alignment = { horizontal: 'right' }

  const prefix = t.prefix[data.clientPrefix]
  sheet.mergeCells('A6:F6')
  const toCell = sheet.getCell('A6')
  toCell.value = `${t.to}: ${[prefix, data.clientName].filter(Boolean).join(' ')}`
  toCell.font = { bold: true, size: 12, color: { argb: INK } }

  const headerRowIndex = 8
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = [t.item, t.qty, t.description, t.photo, t.unitPrice, t.total]
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: INK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = thinBorder
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  headerRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' }

  // Item rows get extra height so the (up to 44px) photo has room to sit
  // inside its cell without being clipped by the default ~20px row height.
  const ITEM_ROW_HEIGHT = 46

  data.items.forEach((item, index) => {
    const rowIndex = headerRowIndex + 1 + index
    const row = sheet.getRow(rowIndex)
    row.height = ITEM_ROW_HEIGHT
    row.values = [index + 1, item.quantity, '', '', item.unitPrice, { formula: `E${rowIndex}*B${rowIndex}` }]
    const description = item.description.trim()
    row.getCell(3).value = {
      richText: [
        { text: item.title, font: { bold: true, color: { argb: INK } } },
        ...(description ? [{ text: ` - ${description}`, font: { color: { argb: INK } } }] : []),
      ],
    }
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(3).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(5).alignment = { vertical: 'middle' }
    row.getCell(6).alignment = { vertical: 'middle' }
    row.getCell(5).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(6).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(6).font = { color: { argb: RED }, bold: true }
    row.eachCell((cell) => (cell.border = thinBorder))

    if (item.photoDataUri) {
      const { base64, extension } = dataUriToImage(item.photoDataUri)
      const photoImageId = workbook.addImage({ base64, extension })
      // Row index is 0-based for addImage; center the ~40px photo in the
      // ~46pt-tall, ~75px-wide cell with a small inset on every side.
      sheet.addImage(photoImageId, {
        tl: { col: 3.13, row: rowIndex - 1 + 0.12 },
        ext: { width: 40, height: 40 },
      })
    }
  })

  const lastItemRow = headerRowIndex + data.items.length
  const summaryTop = lastItemRow + 1

  // Tracks how far down the notes merge extends (0 if there are no notes)
  // so the signature block below is guaranteed to start after it — the
  // notes span is dynamic, and any signature row landing inside a merged
  // range would silently overwrite the merge's shared value.
  let notesBottom = summaryTop - 1

  if (data.notes) {
    // Give the notes block exactly as many rows as it has lines (plus a
    // little breathing room), instead of a fixed count that clipped longer
    // note lists — each line here is short enough to stay on one wrapped
    // row within column A:C's combined width.
    const noteLineCount = data.notes.split('\n').length
    const notesRowSpan = Math.max(6, noteLineCount + 1)
    notesBottom = summaryTop + notesRowSpan - 1
    sheet.mergeCells(`A${summaryTop}:C${notesBottom}`)
    const notesCell = sheet.getCell(`A${summaryTop}`)
    notesCell.value = data.notes
    notesCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    notesCell.font = { size: 9, color: { argb: 'FF4A4A4A' } }
    for (let r = summaryTop; r <= notesBottom; r++) {
      ;['A', 'B', 'C'].forEach((col) => (sheet.getCell(`${col}${r}`).border = thinBorder))
    }
  }

  let row = summaryTop
  sheet.getCell(`E${row}`).value = t.shipping
  sheet.getCell(`E${row}`).font = { bold: true, color: { argb: INK } }
  sheet.getCell(`E${row}`).border = thinBorder
  sheet.getCell(`F${row}`).value = data.freight ?? t.toBeDefined
  if (data.freight !== null) sheet.getCell(`F${row}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`F${row}`).font = { bold: true, color: { argb: RED } }
  sheet.getCell(`F${row}`).border = thinBorder
  const freightRow = row
  row++

  let discountRow: number | null = null
  if (data.discount > 0) {
    sheet.getCell(`E${row}`).value = t.discount
    sheet.getCell(`E${row}`).font = { bold: true, color: { argb: INK } }
    sheet.getCell(`E${row}`).border = thinBorder
    sheet.getCell(`F${row}`).value = -data.discount
    sheet.getCell(`F${row}`).numFmt = `"${data.currency}" #,##0.00`
    sheet.getCell(`F${row}`).font = { bold: true, color: { argb: RED } }
    sheet.getCell(`F${row}`).border = thinBorder
    discountRow = row
    row++
  }

  sheet.getCell(`E${row}`).value = t.total
  sheet.getCell(`E${row}`).font = { bold: true, size: 12, color: { argb: INK } }
  sheet.getCell(`E${row}`).border = thinBorder
  const freightRef = data.freight !== null ? `F${freightRow}` : '0'
  const discountRef = discountRow ? `+F${discountRow}` : ''
  sheet.getCell(`F${row}`).value = {
    formula: `SUM(F${headerRowIndex + 1}:F${lastItemRow})+${freightRef}${discountRef}`,
  }
  sheet.getCell(`F${row}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`F${row}`).font = { bold: true, size: 12, color: { argb: RED } }
  sheet.getCell(`F${row}`).border = thinBorder

  const sigTop = Math.max(row + 3, notesBottom + 2)
  // A plain top border (not a merge) draws the same divider line without
  // clobbering the independent name/role/contact values written below —
  // merging A:F across every row here previously made every write share
  // one cell, so only the last line (the email) ever survived.
  ;['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
    sheet.getCell(`${col}${sigTop}`).border = { top: { style: 'thin', color: { argb: BORDER_COLOR } } }
  })

  if (data.signature.signatureImageDataUri) {
    // Own signature replaces the company logo + text block entirely.
    const { base64, extension } = dataUriToImage(data.signature.signatureImageDataUri)
    const sigImageId = workbook.addImage({ base64, extension })
    sheet.addImage(sigImageId, { tl: { col: 0.2, row: sigTop - 1 + 0.3 }, ext: { width: 180, height: 70 } })
  } else {
    const sigLogoImageId = workbook.addImage({ buffer: logoBuffer as any, extension: 'png' })
    // Column A is 75px wide and this logo is 50px, so — unlike before this
    // column was widened — it no longer needs a row offset to avoid
    // overlapping the bold name text next to it in column B.
    sheet.addImage(sigLogoImageId, { tl: { col: 0.15, row: sigTop - 1 + 0.15 }, ext: { width: 50, height: 41 } })

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
