import ExcelJS from 'exceljs'

export interface ExportDocItem {
  code: string
  quantity: number
  unitPriceUsd: number
  weightKgUnit: number | null
}

export interface ExportDocData {
  orderNumber: number
  exchangeRate: number
  currency: string
  items: ExportDocItem[]
  freight: number | null
}

const RED = 'FFEF1818'
const INK = 'FF1A1A1A'
const MUTED = 'FF6A6A6A'
const HEADER_FILL = 'FFF1EFE9'
const BORDER_COLOR = 'FFE2E0D8'
const EDITABLE_FILL = 'FFFFF3CD'
const EDITABLE_BORDER = 'FFE0B400'

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
}

const editableBorder = {
  top: { style: 'thin' as const, color: { argb: EDITABLE_BORDER } },
  bottom: { style: 'thin' as const, color: { argb: EDITABLE_BORDER } },
  left: { style: 'thin' as const, color: { argb: EDITABLE_BORDER } },
  right: { style: 'thin' as const, color: { argb: EDITABLE_BORDER } },
}

export async function generateExportDocXlsx(data: ExportDocData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Exportação', { views: [{ showGridLines: false }] })

  sheet.columns = [
    { width: 3 },
    { width: 7 },
    { width: 30 },
    { width: 11 },
    { width: 12 },
    { width: 13 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 14 },
    { width: 13 },
  ]

  sheet.mergeCells('B1:E1')
  const titleCell = sheet.getCell('B1')
  titleCell.value = `Documento de Exportação — Pedido ${data.orderNumber}`
  titleCell.font = { bold: true, size: 14, color: { argb: INK } }

  sheet.getCell('B3').value = 'Câmbio USD/BRL'
  sheet.getCell('B3').font = { bold: true, size: 10, color: { argb: INK } }
  sheet.mergeCells('C3:D3')
  const rateCell = sheet.getCell('C3')
  rateCell.value = data.exchangeRate
  rateCell.numFmt = '0.0000'
  rateCell.font = { bold: true, size: 12, color: { argb: INK } }
  rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  rateCell.border = thinBorder
  sheet.getCell('E3').value = '(editável — câmbio do dia)'
  sheet.getCell('E3').font = { italic: true, size: 9, color: { argb: MUTED } }

  sheet.mergeCells('B4:D4')
  const legendCell = sheet.getCell('B4')
  legendCell.value = 'Células em amarelo (KG Unit.) precisam ser preenchidas manualmente — o resto calcula sozinho.'
  legendCell.font = { italic: true, size: 9, color: { argb: MUTED } }

  const headerRowIndex = 6
  const headers = [
    'Qtd',
    'Cód.',
    'US/Eur',
    'Conversão',
    'V. Tot. R$',
    'KG Unit.',
    'KG x Qtd',
    'R$ x KG',
    'R$ Total Prod',
    `TOTAL ${data.currency}`,
  ]
  const headerRow = sheet.getRow(headerRowIndex)
  headers.forEach((h, i) => (headerRow.getCell(i + 2).value = h))
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber < 2) return
    cell.font = { bold: true, size: 10, color: { argb: INK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.border = thinBorder
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  headerRow.height = 26

  const items = [...data.items]
  if (data.freight !== null) {
    items.push({ code: 'Shipping', quantity: 1, unitPriceUsd: data.freight, weightKgUnit: null })
  }

  items.forEach((item, index) => {
    const rowIndex = headerRowIndex + 1 + index
    const row = sheet.getRow(rowIndex)
    row.getCell(2).value = item.quantity
    row.getCell(3).value = item.code
    row.getCell(4).value = item.unitPriceUsd
    row.getCell(5).value = { formula: `D${rowIndex}*$C$3` }
    row.getCell(6).value = { formula: `E${rowIndex}*B${rowIndex}` }
    // Weight per unit isn't always known from the catalog — leave it blank and
    // highlighted for manual entry, but the dependent formulas are always wired
    // up so filling it in later immediately cascades through the row.
    if (item.weightKgUnit !== null) {
      row.getCell(7).value = item.weightKgUnit
    }
    row.getCell(8).value = { formula: `B${rowIndex}*G${rowIndex}` }
    row.getCell(9).value = { formula: `IF(H${rowIndex}=0,0,F${rowIndex}/H${rowIndex})` }
    row.getCell(10).value = { formula: `I${rowIndex}*H${rowIndex}` }
    row.getCell(11).value = { formula: `D${rowIndex}*B${rowIndex}` }

    row.eachCell((cell, colNumber) => {
      if (colNumber < 2) return
      cell.border = thinBorder
    })
    if (item.weightKgUnit === null) {
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EDITABLE_FILL } }
      row.getCell(7).border = editableBorder
    }
    row.getCell(4).numFmt = '#,##0.00'
    row.getCell(5).numFmt = '#,##0.00'
    row.getCell(6).numFmt = '#,##0.00'
    row.getCell(7).numFmt = '0.000'
    row.getCell(8).numFmt = '0.000'
    row.getCell(9).numFmt = '#,##0.00'
    row.getCell(10).numFmt = '#,##0.00'
    row.getCell(11).numFmt = '#,##0.00'
  })

  const lastItemRow = headerRowIndex + items.length
  const totalsRow = sheet.getRow(lastItemRow + 1)
  totalsRow.getCell(2).value = { formula: `SUBTOTAL(109,B${headerRowIndex + 1}:B${lastItemRow})` }
  totalsRow.getCell(5).value = { formula: `SUBTOTAL(109,E${headerRowIndex + 1}:E${lastItemRow})` }
  totalsRow.getCell(8).value = { formula: `SUBTOTAL(109,H${headerRowIndex + 1}:H${lastItemRow})` }
  totalsRow.getCell(10).value = { formula: `SUBTOTAL(109,J${headerRowIndex + 1}:J${lastItemRow})` }
  totalsRow.getCell(11).value = { formula: `SUBTOTAL(109,K${headerRowIndex + 1}:K${lastItemRow})` }
  totalsRow.eachCell((cell, colNumber) => {
    if (colNumber < 2) return
    cell.font = { bold: true, color: { argb: INK } }
    cell.border = { top: { style: 'double', color: { argb: BORDER_COLOR } } }
    cell.numFmt = '#,##0.00'
  })
  totalsRow.getCell(2).numFmt = '0'
  totalsRow.getCell(11).font = { bold: true, color: { argb: RED } }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
