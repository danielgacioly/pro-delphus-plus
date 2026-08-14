import { Router } from 'express'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { ZipArchive, type ArchiverError } from 'archiver'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toOrderDTO } from '../lib/dto.js'
import { generateInvoicePdf, generatePackingListPdf, generatePackingListBoxPdf, type PackingListBoxPage } from '../lib/orderPdf.js'
import { generateExportDocXlsx } from '../lib/orderXlsx.js'
import { fetchUsdBrlRate } from '../lib/exchangeRate.js'
import { upload, publicUrlFor, deleteStoredFile } from '../storage/local.js'
import { env } from '../lib/env.js'
import type { BoxAssignments } from '@prodelphusplus/shared'

export const ordersRouter = Router()

ordersRouter.use(requireAuth)

const FIRST_ORDER_NUMBER = 2800

const quoteInclude = {
  items: { include: { product: true } },
  createdBy: { select: { id: true, name: true } },
  client: { select: { country: true } },
} as const
const include = { createdBy: { select: { id: true, name: true } }, quote: { include: quoteInclude } } as const

ordersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const orders = await prisma.order.findMany({ include, orderBy: { orderNumber: 'desc' } })
    res.json({ orders: orders.map(toOrderDTO) })
  }),
)

ordersRouter.get(
  '/exchange-rate',
  asyncHandler(async (_req, res) => {
    const rate = await fetchUsdBrlRate()
    res.json({ rate })
  }),
)

// Um `<a download>` por arquivo, disparado em sequência via JS, esbarra no
// limite do navegador de bloquear downloads automáticos consecutivos sem
// gesto do usuário a cada um (só o primeiro sai; o resto é silenciosamente
// bloqueado) — por isso "Baixar tudo" empacota tudo num único .zip em vez de
// disparar vários downloads.
ordersRouter.get(
  '/:id/documents.zip',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!order) throw new HttpError(404, 'Pedido não encontrado')

    const docs = [
      order.invoicePdfUrl && { url: order.invoicePdfUrl, filename: `Order-${order.orderNumber}-Invoice.pdf` },
      order.packingListPdfUrl && { url: order.packingListPdfUrl, filename: `Order-${order.orderNumber}-PackingList.pdf` },
      order.packingListBoxPdfUrl && {
        url: order.packingListBoxPdfUrl,
        filename: `Order-${order.orderNumber}-PackingListBox.pdf`,
      },
      order.exportDocXlsxUrl && { url: order.exportDocXlsxUrl, filename: `Order-${order.orderNumber}-Export.xlsx` },
      order.awbDocumentUrl && {
        url: order.awbDocumentUrl,
        filename: `Order-${order.orderNumber}-AWB${path.extname(order.awbDocumentUrl)}`,
      },
      order.nfDocumentUrl && {
        url: order.nfDocumentUrl,
        filename: `Order-${order.orderNumber}-NF${path.extname(order.nfDocumentUrl)}`,
      },
    ].filter((d): d is { url: string; filename: string } => Boolean(d))

    if (docs.length === 0) throw new HttpError(404, 'Nenhum documento disponível para este pedido')

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="Order-${order.orderNumber}-Documents.zip"`)

    const archive = new ZipArchive({ zlib: { level: 9 } })
    archive.on('error', (err: ArchiverError) => res.destroy(err))
    archive.pipe(res)

    const uploadsDir = path.resolve(env.UPLOADS_DIR)
    for (const doc of docs) {
      const filePath = path.join(uploadsDir, path.basename(doc.url))
      if (fsSync.existsSync(filePath)) archive.file(filePath, { name: doc.filename })
    }

    await archive.finalize()
  }),
)

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include })
    if (!order) throw new HttpError(404, 'Pedido não encontrado')
    res.json({ order: toOrderDTO(order) })
  }),
)

async function nextOrderNumber() {
  const last = await prisma.order.findFirst({ orderBy: { orderNumber: 'desc' } })
  return last ? last.orderNumber + 1 : FIRST_ORDER_NUMBER
}

const orderFieldsSchema = z.object({
  quoteId: z.string().min(1),
  purchaseOrder: z.string().optional(),
  orderedByEmail: z.string().email(),
  shipDate: z.coerce.date().optional(),
  billToText: z.string().min(1),
  shipToText: z.string().min(1),
  shipToNote: z.string().optional(),
  netWeightKg: z.coerce.number().positive().optional(),
  grossWeightKg: z.coerce.number().positive().optional(),
  awbNumber: z.string().optional(),
  incoterms: z.string().optional(),
  prepaymentBy: z.enum(['PAYPAL', 'WIRE_TRANSFER']).optional(),
  paypalFee: z.coerce.number().min(0).optional(),
  nfNumber: z.string().optional(),
  nfDate: z.coerce.date().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  itemWeightsKg: z.array(z.coerce.number().positive().nullable()).optional(),
  packageCount: z.coerce.number().int().positive().optional(),
  boxAssignments: z
    .array(z.array(z.object({ label: z.string().min(1), quantity: z.number().int().positive() })))
    .optional(),
})

// "01 Carton" / "02 Cartons" — the Invoice/Packing List "Number of Packages"
// field is always derived from packageCount rather than free-typed, so it
// can never drift out of sync with how many Packing List Box pages exist.
function formatPackageCountLabel(count: number) {
  return `${String(count).padStart(2, '0')} ${count === 1 ? 'Carton' : 'Cartons'}`
}

function buildBoxPages(
  packageCount: number,
  boxAssignments: BoxAssignments | null,
  docItems: { title: string; quantity: number }[],
): PackingListBoxPage[] {
  if (!boxAssignments || boxAssignments.length === 0) {
    // No explicit box assignment — everything ships in box 1; any additional
    // declared boxes are left empty rather than guessing a split.
    return Array.from({ length: packageCount }, (_, i) => ({
      boxNumber: i + 1,
      totalBoxes: packageCount,
      items: i === 0 ? docItems.map((it) => ({ title: it.title, quantity: it.quantity })) : [],
    }))
  }
  return Array.from({ length: packageCount }, (_, i) => ({
    boxNumber: i + 1,
    totalBoxes: packageCount,
    items: (boxAssignments[i] ?? []).map((entry) => ({ title: entry.label, quantity: entry.quantity })),
  }))
}

async function buildAndWriteDocuments(
  order: {
    orderNumber: number
    purchaseOrder: string | null
    orderedByEmail: string
    invoiceDate: Date
    billToText: string
    shipToText: string
    netWeightKg: number | null
    grossWeightKg: number | null
    awbNumber: string | null
    incoterms: string | null
    prepaymentBy: 'PAYPAL' | 'WIRE_TRANSFER'
    paypalFee: number | null
    nfNumber: string | null
    nfDate: Date | null
    exchangeRate: number
    itemWeightsKg: (number | null)[] | null
    packageCount: number
    boxAssignments: BoxAssignments | null
  },
  quote: {
    quoteNumber: string
    currency: string
    freight: unknown
    discount: unknown
    items: { quantity: number; unitPrice: unknown; lineTotal: unknown; description: string; product: { name: string; weightKg: unknown } }[]
  },
) {
  const currency = quote.currency
  const freight = quote.freight !== null ? Number(quote.freight) : null
  const discount = Number(quote.discount)

  const docItems = quote.items.map((item) => ({
    title: item.product.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  }))

  const subtotal = docItems.reduce((sum, i) => sum + i.lineTotal, 0)
  const total = subtotal + (freight ?? 0) - discount + (order.paypalFee ?? 0)

  // If no purchase order was given, the invoice falls back to the source
  // quote's number (not the order's own number).
  const purchaseOrderDisplay = order.purchaseOrder || quote.quoteNumber

  const docData = {
    orderNumber: order.orderNumber,
    invoiceDate: order.invoiceDate,
    purchaseOrder: purchaseOrderDisplay,
    orderedByEmail: order.orderedByEmail,
    items: docItems,
    currency,
    freight,
    discount: discount > 0 ? discount : null,
    paypalFee: order.prepaymentBy === 'PAYPAL' ? order.paypalFee : null,
    total,
    billToText: order.billToText,
    shipToText: order.shipToText,
    numberOfPackages: formatPackageCountLabel(order.packageCount),
    netWeightKg: order.netWeightKg !== null ? String(order.netWeightKg) : null,
    grossWeightKg: order.grossWeightKg !== null ? String(order.grossWeightKg) : null,
    awbNumber: order.awbNumber,
    incoterms: order.incoterms,
    prepaymentBy: order.prepaymentBy,
    nfDate: order.nfDate,
    nfNumber: order.nfNumber,
  }

  const boxData = {
    orderNumber: order.orderNumber,
    shipToText: order.shipToText,
    pages: buildBoxPages(order.packageCount, order.boxAssignments, docItems),
  }

  const exportData = {
    orderNumber: order.orderNumber,
    exchangeRate: order.exchangeRate,
    currency,
    freight,
    paypalFee: order.prepaymentBy === 'PAYPAL' ? order.paypalFee : null,
    discount: discount > 0 ? discount : null,
    netWeightKg: order.netWeightKg,
    grossWeightKg: order.grossWeightKg,
    packageCount: order.packageCount,
    items: quote.items.map((item, index) => {
      // A manually entered per-order weight (from the order form) takes
      // priority over the product's catalog weight, which is often blank.
      const manualWeight = order.itemWeightsKg?.[index]
      const weightKgUnit =
        manualWeight !== undefined && manualWeight !== null
          ? manualWeight
          : item.product.weightKg !== null
            ? Number(item.product.weightKg)
            : null
      return {
        code: item.product.name,
        quantity: item.quantity,
        unitPriceUsd: Number(item.unitPrice),
        weightKgUnit,
      }
    }),
  }

  const [invoiceBuffer, packingListBuffer, packingListBoxBuffer, exportDocBuffer] = await Promise.all([
    generateInvoicePdf(docData),
    generatePackingListPdf(docData),
    generatePackingListBoxPdf(boxData),
    generateExportDocXlsx(exportData),
  ])

  const uploadsDir = path.resolve(env.UPLOADS_DIR)
  await fs.mkdir(uploadsDir, { recursive: true })
  const filenames = {
    invoice: `Order-${order.orderNumber}-Invoice.pdf`,
    packingList: `Order-${order.orderNumber}-PackingList.pdf`,
    packingListBox: `Order-${order.orderNumber}-PackingListBox.pdf`,
    exportDoc: `Order-${order.orderNumber}-Export.xlsx`,
  }
  await Promise.all([
    fs.writeFile(path.join(uploadsDir, filenames.invoice), invoiceBuffer),
    fs.writeFile(path.join(uploadsDir, filenames.packingList), packingListBuffer),
    fs.writeFile(path.join(uploadsDir, filenames.packingListBox), packingListBoxBuffer),
    fs.writeFile(path.join(uploadsDir, filenames.exportDoc), exportDocBuffer),
  ])

  return {
    invoicePdfUrl: publicUrlFor(filenames.invoice),
    packingListPdfUrl: publicUrlFor(filenames.packingList),
    packingListBoxPdfUrl: publicUrlFor(filenames.packingListBox),
    exportDocXlsxUrl: publicUrlFor(filenames.exportDoc),
  }
}

ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = orderFieldsSchema.parse(req.body)

    const quote = await prisma.quote.findUnique({ where: { id: data.quoteId }, include: quoteInclude })
    if (!quote) throw new HttpError(404, 'Orçamento não encontrado')
    if (quote.items.length === 0) throw new HttpError(400, 'Este orçamento não possui itens')

    const orderNumber = await nextOrderNumber()
    // Nunca cair silenciosamente para um câmbio de 1 — isso corrompe o valor
    // total do Invoice/Export Doc sem aviso nenhum. Se não veio do form e a
    // busca automática falhar, é melhor recusar e pedir para digitar à mão.
    const exchangeRate =
      data.exchangeRate ??
      (await fetchUsdBrlRate().catch(() => {
        throw new HttpError(400, 'Não foi possível obter o câmbio automaticamente. Informe o valor manualmente.')
      }))
    const packageCount = data.packageCount ?? 1
    const prepaymentBy = data.prepaymentBy ?? 'WIRE_TRANSFER'

    const orderForDocs = {
      orderNumber,
      purchaseOrder: data.purchaseOrder ?? null,
      orderedByEmail: data.orderedByEmail,
      invoiceDate: new Date(),
      billToText: data.billToText,
      shipToText: data.shipToText,
      netWeightKg: data.netWeightKg ?? null,
      grossWeightKg: data.grossWeightKg ?? null,
      awbNumber: data.awbNumber ?? null,
      incoterms: data.incoterms ?? null,
      prepaymentBy,
      paypalFee: data.paypalFee ?? null,
      nfNumber: data.nfNumber ?? null,
      nfDate: data.nfDate ?? null,
      exchangeRate,
      itemWeightsKg: data.itemWeightsKg ?? null,
      packageCount,
      boxAssignments: data.boxAssignments ?? null,
    }

    const docUrls = await buildAndWriteDocuments(orderForDocs, quote)

    const order = await prisma.order.create({
      data: {
        orderNumber,
        quoteId: data.quoteId,
        purchaseOrder: data.purchaseOrder ?? null,
        orderedByEmail: data.orderedByEmail,
        shipDate: data.shipDate ?? null,
        billToText: data.billToText,
        shipToText: data.shipToText,
        shipToNote: data.shipToNote ?? null,
        numberOfPackages: formatPackageCountLabel(packageCount),
        netWeightKg: data.netWeightKg ?? null,
        grossWeightKg: data.grossWeightKg ?? null,
        awbNumber: data.awbNumber ?? null,
        incoterms: data.incoterms ?? null,
        itemWeightsKg: data.itemWeightsKg,
        packageCount,
        boxAssignments: data.boxAssignments ?? undefined,
        prepaymentBy,
        paypalFee: data.paypalFee ?? null,
        nfNumber: data.nfNumber ?? null,
        nfDate: data.nfDate ?? null,
        exchangeRate,
        ...docUrls,
        createdById: req.user!.id,
      },
      include,
    })

    res.status(201).json({ order: toOrderDTO(order) })
  }),
)

ordersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id }, include: { quote: { include: quoteInclude } } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')

    const data = orderFieldsSchema.omit({ quoteId: true }).partial().parse(req.body)

    const merged = {
      orderNumber: existing.orderNumber,
      purchaseOrder: data.purchaseOrder !== undefined ? data.purchaseOrder || null : existing.purchaseOrder,
      orderedByEmail: data.orderedByEmail ?? existing.orderedByEmail,
      invoiceDate: existing.invoiceDate,
      billToText: data.billToText ?? existing.billToText,
      shipToText: data.shipToText ?? existing.shipToText,
      netWeightKg: data.netWeightKg !== undefined ? data.netWeightKg : existing.netWeightKg !== null ? Number(existing.netWeightKg) : null,
      grossWeightKg:
        data.grossWeightKg !== undefined ? data.grossWeightKg : existing.grossWeightKg !== null ? Number(existing.grossWeightKg) : null,
      awbNumber: data.awbNumber !== undefined ? data.awbNumber || null : existing.awbNumber,
      incoterms: data.incoterms !== undefined ? data.incoterms || null : existing.incoterms,
      prepaymentBy: data.prepaymentBy ?? existing.prepaymentBy,
      paypalFee: data.paypalFee !== undefined ? data.paypalFee : existing.paypalFee !== null ? Number(existing.paypalFee) : null,
      nfNumber: data.nfNumber !== undefined ? data.nfNumber || null : existing.nfNumber,
      nfDate: data.nfDate !== undefined ? data.nfDate ?? null : existing.nfDate,
      exchangeRate: data.exchangeRate ?? (existing.exchangeRate !== null ? Number(existing.exchangeRate) : 1),
      itemWeightsKg: data.itemWeightsKg ?? ((existing.itemWeightsKg as (number | null)[] | null) ?? null),
      packageCount: data.packageCount ?? existing.packageCount,
      boxAssignments: data.boxAssignments ?? ((existing.boxAssignments as BoxAssignments | null) ?? null),
    }

    const docUrls = await buildAndWriteDocuments(merged, existing.quote)

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: {
        purchaseOrder: merged.purchaseOrder,
        orderedByEmail: merged.orderedByEmail,
        shipDate: data.shipDate !== undefined ? data.shipDate ?? null : existing.shipDate,
        billToText: merged.billToText,
        shipToText: merged.shipToText,
        itemWeightsKg: merged.itemWeightsKg ?? undefined,
        packageCount: merged.packageCount,
        boxAssignments: merged.boxAssignments ?? undefined,
        shipToNote: data.shipToNote !== undefined ? data.shipToNote || null : existing.shipToNote,
        numberOfPackages: formatPackageCountLabel(merged.packageCount),
        netWeightKg: merged.netWeightKg,
        grossWeightKg: merged.grossWeightKg,
        awbNumber: merged.awbNumber,
        incoterms: merged.incoterms,
        prepaymentBy: merged.prepaymentBy,
        paypalFee: merged.paypalFee,
        nfNumber: merged.nfNumber,
        nfDate: merged.nfDate,
        exchangeRate: merged.exchangeRate,
        ...docUrls,
      },
      include,
    })

    res.json({ order: toOrderDTO(order) })
  }),
)

const statusSchema = z.object({ status: z.enum(['PENDING', 'COMPLETED']) })

// Lightweight status toggle — unlike PATCH /:id, this never regenerates the
// PDF/xlsx documents (there's nothing document-relevant about status).
ordersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body)
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')

    const order = await prisma.order.update({ where: { id: existing.id }, data: { status }, include })
    res.json({ order: toOrderDTO(order) })
  }),
)

ordersRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')

    for (const url of [
      existing.invoicePdfUrl,
      existing.packingListPdfUrl,
      existing.packingListBoxPdfUrl,
      existing.exportDocXlsxUrl,
      existing.awbDocumentUrl,
      existing.nfDocumentUrl,
    ]) {
      if (url) deleteStoredFile(url)
    }

    await prisma.order.delete({ where: { id: existing.id } })
    res.status(204).send()
  }),
)

ordersRouter.post(
  '/:id/awb-document',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado')
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')
    if (existing.awbDocumentUrl) deleteStoredFile(existing.awbDocumentUrl)

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { awbDocumentUrl: publicUrlFor(req.file.filename) },
      include,
    })
    res.status(201).json({ order: toOrderDTO(order) })
  }),
)

ordersRouter.post(
  '/:id/nf-document',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado')
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')
    if (existing.nfDocumentUrl) deleteStoredFile(existing.nfDocumentUrl)

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { nfDocumentUrl: publicUrlFor(req.file.filename) },
      include,
    })
    res.status(201).json({ order: toOrderDTO(order) })
  }),
)
