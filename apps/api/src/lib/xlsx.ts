import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { clientPrefixLabel } from '@prodelphusplus/shared'
import { LABELS, type QuoteLanguage } from './quoteI18n.js'
import { COMPANY } from './pdf.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoBuffer = fs.readFileSync(path.join(__dirname, '../assets/logo-company.png'))

export interface QuoteXlsxItem {
  title: string
  description: string
  quantity: number
  /** Preço de catálogo. Null quando o produto não tinha preço na moeda do orçamento. */
  listPrice: number | null
  /** Preço cobrado — igual ao de catálogo, salvo quando houve preço especial. */
  unitPrice: number
  photoDataUri: string | null
}

/**
 * Mesmo critério do PDF: só conta como especial quando o preço cobrado é
 * MENOR que o de tabela (desconto negociado). Um preço customizado maior não
 * é "especial" — é só o preço daquele item, sem riscado e sem coluna extra.
 */
function hasSpecialPrice(item: QuoteXlsxItem) {
  return item.listPrice !== null && item.unitPrice < item.listPrice
}

export interface QuoteXlsxData {
  quoteNumber: string
  language: QuoteLanguage
  clientPrefix: 'NONE' | 'MR' | 'MS'
  clientName: string
  /** País do cliente vinculado — decide Sr./Sra. vs Mr./Ms., ver clientPrefixLabel. */
  clientCountry: string | null
  notes: string | null
  items: QuoteXlsxItem[]
  freight: number | null
  discount: number
  subtotal: number
  total: number
  currency: string
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

  // A coluna de preço especial entra só quando algum item foi negociado, então
  // todas as referências abaixo são calculadas em vez de escritas à mão: sem
  // isso a planilha ganharia uma coluna e os totais continuariam apontando para
  // a antiga.
  const showSpecial = data.items.some(hasSpecialPrice)
  const SPECIAL_COL = 6
  const totalCol = showSpecial ? 7 : 6
  const labelCol = totalCol - 1
  const colLetter = (index: number) => String.fromCharCode(64 + index)
  const TOTAL = colLetter(totalCol)
  const LABEL = colLetter(labelCol)
  const LAST = TOTAL

  // Column A is 10 chars (~75px) wide — just for the item-number cells, but
  // also wide enough to hold the 60px header/signature logo without it
  // spilling into column B and overlapping the company name/signature text.
  sheet.columns = [
    { width: 10 },
    { width: 8 },
    { width: 44 },
    { width: 10 },
    { width: 18 },
    ...(showSpecial ? [{ width: 18 }] : []),
    { width: 18 },
  ]

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

  sheet.mergeCells(`${LABEL}1:${TOTAL}1`)
  const titleCell = sheet.getCell(`${LABEL}1`)
  titleCell.value = t.quote
  titleCell.font = { bold: true, size: 22, color: { argb: INK } }
  titleCell.alignment = { horizontal: 'right' }

  sheet.mergeCells(`${LABEL}2:${TOTAL}2`)
  const numberCell = sheet.getCell(`${LABEL}2`)
  numberCell.value = `#${data.quoteNumber}`
  numberCell.font = { bold: true, size: 12, color: { argb: INK } }
  numberCell.alignment = { horizontal: 'right' }

  const prefix = clientPrefixLabel(data.clientPrefix, data.clientCountry, data.language)
  sheet.mergeCells(`A6:${LAST}6`)
  const toCell = sheet.getCell('A6')
  toCell.value = `${t.to}: ${[prefix, data.clientName].filter(Boolean).join(' ')}`
  toCell.font = { bold: true, size: 12, color: { argb: INK } }

  const headerRowIndex = 8
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = [
    t.item,
    t.qty,
    t.description,
    t.photo,
    t.unitPrice,
    ...(showSpecial ? [t.specialPrice] : []),
    t.total,
  ]
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
    // A coluna especial fica em branco ("—") nos itens não negociados, igual ao
    // PDF. Como a planilha precisa continuar recalculando sozinha, a fórmula
    // escolhe a coluna em tempo de cálculo em vez de duplicar o preço.
    const special = colLetter(SPECIAL_COL)
    const priceRef = showSpecial
      ? `IF(ISNUMBER(${special}${rowIndex}),${special}${rowIndex},E${rowIndex})`
      : `E${rowIndex}`
    row.values = [
      index + 1,
      item.quantity,
      '',
      '',
      item.listPrice === null ? '—' : hasSpecialPrice(item) ? item.listPrice : item.unitPrice,
      ...(showSpecial ? [hasSpecialPrice(item) || item.listPrice === null ? item.unitPrice : '—'] : []),
      { formula: `${priceRef}*B${rowIndex}` },
    ]
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
    row.getCell(totalCol).alignment = { vertical: 'middle' }
    if (item.listPrice !== null) row.getCell(5).numFmt = `"${data.currency}" #,##0.00`
    if (hasSpecialPrice(item)) row.getCell(5).font = { color: { argb: 'FF8A8A8A' }, strike: true }
    if (showSpecial) {
      row.getCell(SPECIAL_COL).alignment = { vertical: 'middle' }
      if (hasSpecialPrice(item) || item.listPrice === null) {
        row.getCell(SPECIAL_COL).numFmt = `"${data.currency}" #,##0.00`
      } else {
        row.getCell(SPECIAL_COL).alignment = { vertical: 'middle', horizontal: 'center' }
      }
      if (hasSpecialPrice(item)) row.getCell(SPECIAL_COL).font = { color: { argb: RED }, bold: true }
    }
    row.getCell(totalCol).numFmt = `"${data.currency}" #,##0.00`
    row.getCell(totalCol).font = { color: { argb: RED }, bold: true }
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

  // Notes span every column up to right before the summary labels (LABEL),
  // not just A:C — stopping at C left D/E as a blank gap between the notes
  // box and the Shipping/Total block, since both sit on the same rows.
  const notesLastCol = colLetter(labelCol - 1)

  if (data.notes) {
    // Give the notes block exactly as many rows as it has lines (plus a
    // little breathing room), instead of a fixed count that clipped longer
    // note lists — each line here is short enough to stay on one wrapped
    // row within the combined column width.
    const noteLineCount = data.notes.split('\n').length
    const notesRowSpan = Math.max(6, noteLineCount + 1)
    notesBottom = summaryTop + notesRowSpan - 1
    sheet.mergeCells(`A${summaryTop}:${notesLastCol}${notesBottom}`)
    const notesCell = sheet.getCell(`A${summaryTop}`)
    notesCell.value = data.notes
    notesCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    notesCell.font = { size: 9, color: { argb: 'FF4A4A4A' } }
    for (let r = summaryTop; r <= notesBottom; r++) {
      for (let c = 1; c <= labelCol - 1; c++) sheet.getCell(`${colLetter(c)}${r}`).border = thinBorder
    }
  }

  let row = summaryTop
  sheet.getCell(`${LABEL}${row}`).value = t.shipping
  sheet.getCell(`${LABEL}${row}`).font = { bold: true, color: { argb: INK } }
  sheet.getCell(`${LABEL}${row}`).border = thinBorder
  sheet.getCell(`${TOTAL}${row}`).value = data.freight ?? t.toBeDefined
  if (data.freight !== null) sheet.getCell(`${TOTAL}${row}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`${TOTAL}${row}`).font = { bold: true, color: { argb: RED } }
  sheet.getCell(`${TOTAL}${row}`).border = thinBorder
  const freightRow = row
  row++

  let discountRow: number | null = null
  if (data.discount > 0) {
    sheet.getCell(`${LABEL}${row}`).value = t.discount
    sheet.getCell(`${LABEL}${row}`).font = { bold: true, color: { argb: INK } }
    sheet.getCell(`${LABEL}${row}`).border = thinBorder
    sheet.getCell(`${TOTAL}${row}`).value = -data.discount
    sheet.getCell(`${TOTAL}${row}`).numFmt = `"${data.currency}" #,##0.00`
    sheet.getCell(`${TOTAL}${row}`).font = { bold: true, color: { argb: RED } }
    sheet.getCell(`${TOTAL}${row}`).border = thinBorder
    discountRow = row
    row++
  }

  sheet.getCell(`${LABEL}${row}`).value = t.total
  sheet.getCell(`${LABEL}${row}`).font = { bold: true, size: 12, color: { argb: INK } }
  sheet.getCell(`${LABEL}${row}`).border = thinBorder
  const freightRef = data.freight !== null ? `${TOTAL}${freightRow}` : '0'
  const discountRef = discountRow ? `+${TOTAL}${discountRow}` : ''
  sheet.getCell(`${TOTAL}${row}`).value = {
    formula: `SUM(${TOTAL}${headerRowIndex + 1}:${TOTAL}${lastItemRow})+${freightRef}${discountRef}`,
  }
  sheet.getCell(`${TOTAL}${row}`).numFmt = `"${data.currency}" #,##0.00`
  sheet.getCell(`${TOTAL}${row}`).font = { bold: true, size: 12, color: { argb: RED } }
  sheet.getCell(`${TOTAL}${row}`).border = thinBorder

  // Fecha visualmente a caixa Shipping/Discount/Total até a mesma altura do
  // bloco de notas ao lado — sem isto, a caixa de notas (que cresce com o
  // texto) deixa esta caixa visivelmente mais baixa e o par de blocos não
  // fecha na mesma linha. Cada coluna vira uma única célula mesclada em vez
  // de uma célula por linha, igual ao próprio bloco de notas ao lado.
  if (notesBottom > row) {
    sheet.mergeCells(`${LABEL}${row + 1}:${LABEL}${notesBottom}`)
    sheet.getCell(`${LABEL}${row + 1}`).border = thinBorder
    sheet.mergeCells(`${TOTAL}${row + 1}:${TOTAL}${notesBottom}`)
    sheet.getCell(`${TOTAL}${row + 1}`).border = thinBorder
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
