import { Router } from 'express'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { ZipArchive, type ArchiverError } from 'archiver'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toOrderDTO } from '../lib/dto.js'
import { generateInvoicePdf, generatePackingListPdf, generatePackingListBoxPdf } from '../lib/orderPdf.js'
import { generateExportDocXlsx } from '../lib/orderXlsx.js'
import { fetchExchangeRate } from '../lib/exchangeRate.js'
import { upload, publicUrlFor, deleteStoredFile, storageFilename, versionedUrlFor } from '../storage/local.js'
import { env } from '../lib/env.js'
import { reservationBackoff } from '../lib/numbering.js'
import { formatOrderNumber, invoiceTotal, type BoxAssignments, type PrepaymentMethod } from '@prodelphusplus/shared'
import { boxAssignmentsFit, buildBoxPages, formatPackageCountLabel } from '../domain/packaging.js'
import { missingPostOrderDocs, prepaymentRejection } from '../domain/orderDocuments.js'
import { ensureColumns, findDoneColumnId } from './tasks.routes.js'

export const ordersRouter = Router()

ordersRouter.use(requireAuth)

const quoteInclude = {
  items: { include: { product: true } },
  createdBy: { select: { id: true, name: true } },
  client: { select: { country: true } },
} as const
const include = { createdBy: { select: { id: true, name: true } }, quote: { include: quoteInclude } } as const

// `documentsGeneratedAt` (Order) e `updatedAt` (Quote) não estão no client
// tipado (mesma limitação de `prisma generate` documentada em
// tasks.routes.ts) — lidos via SQL bruto e juntados antes de montar o DTO,
// só para calcular `documentsStale`.
type RawOrder = Omit<Parameters<typeof toOrderDTO>[0], 'documentsGeneratedAt' | 'quote'> & {
  quote: Omit<Parameters<typeof toOrderDTO>[0]['quote'], 'updatedAt'>
}

export async function toOrderDTOFresh(order: RawOrder) {
  const [docRows, quoteRows] = await Promise.all([
    prisma.$queryRaw<{ documentsGeneratedAt: Date }[]>`SELECT "documentsGeneratedAt" FROM orders WHERE id = ${order.id}`,
    prisma.$queryRaw<{ updatedAt: Date }[]>`SELECT "updatedAt" FROM quotes WHERE id = ${order.quoteId}`,
  ])
  return toOrderDTO({
    ...order,
    documentsGeneratedAt: docRows[0].documentsGeneratedAt,
    quote: { ...order.quote, updatedAt: quoteRows[0].updatedAt },
  })
}

async function toOrderDTOsFresh(orders: RawOrder[]) {
  if (orders.length === 0) return []
  const orderIds = orders.map((o) => o.id)
  const quoteIds = orders.map((o) => o.quoteId)
  const [docRows, quoteRows] = await Promise.all([
    prisma.$queryRaw<{ id: string; documentsGeneratedAt: Date }[]>`SELECT id, "documentsGeneratedAt" FROM orders WHERE id = ANY(${orderIds})`,
    prisma.$queryRaw<{ id: string; updatedAt: Date }[]>`SELECT id, "updatedAt" FROM quotes WHERE id = ANY(${quoteIds})`,
  ])
  const docMap = new Map(docRows.map((r) => [r.id, r.documentsGeneratedAt]))
  const quoteMap = new Map(quoteRows.map((r) => [r.id, r.updatedAt]))
  return orders.map((order) =>
    toOrderDTO({
      ...order,
      documentsGeneratedAt: docMap.get(order.id)!,
      quote: { ...order.quote, updatedAt: quoteMap.get(order.quoteId)! },
    }),
  )
}

ordersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const orders = await prisma.order.findMany({ include, orderBy: { orderNumber: 'desc' } })
    res.json({ orders: await toOrderDTOsFresh(orders) })
  }),
)

ordersRouter.get(
  '/exchange-rate',
  asyncHandler(async (req, res) => {
    // Pedido em EUR precisa do câmbio EUR/BRL, não USD/BRL — ver Quote.currency.
    const currency = req.query.currency === 'EUR' ? 'EUR' : 'USD'
    const rate = await fetchExchangeRate(currency)
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

    const orderNumber = formatOrderNumber(order.orderNumber)
    const docs = [
      order.invoicePdfUrl && { url: order.invoicePdfUrl, filename: `Order-${orderNumber}-Invoice.pdf` },
      order.packingListPdfUrl && { url: order.packingListPdfUrl, filename: `Order-${orderNumber}-PackingList.pdf` },
      order.packingListBoxPdfUrl && {
        url: order.packingListBoxPdfUrl,
        filename: `Order-${orderNumber}-PackingListBox.pdf`,
      },
      order.exportDocXlsxUrl && { url: order.exportDocXlsxUrl, filename: `Order-${orderNumber}-Export.xlsx` },
      order.awbDocumentUrl && {
        url: order.awbDocumentUrl,
        filename: `Order-${orderNumber}-AWB${path.extname(storageFilename(order.awbDocumentUrl))}`,
      },
      order.boletoDocumentUrl && {
        url: order.boletoDocumentUrl,
        filename: `Order-${orderNumber}-Boleto${path.extname(storageFilename(order.boletoDocumentUrl))}`,
      },
      order.nfDocumentUrl && {
        url: order.nfDocumentUrl,
        filename: `Order-${orderNumber}-NF${path.extname(storageFilename(order.nfDocumentUrl))}`,
      },
    ].filter((d): d is { url: string; filename: string } => Boolean(d))

    if (docs.length === 0) throw new HttpError(404, 'Nenhum documento disponível para este pedido')

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="Order-${orderNumber}-Documents.zip"`)

    const archive = new ZipArchive({ zlib: { level: 9 } })
    archive.on('error', (err: ArchiverError) => res.destroy(err))
    archive.pipe(res)

    const uploadsDir = path.resolve(env.UPLOADS_DIR)
    for (const doc of docs) {
      const filePath = path.join(uploadsDir, storageFilename(doc.url))
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
    res.json({ order: await toOrderDTOFresh(order) })
  }),
)

/** Aplica a regra de `domain/orderDocuments.ts` na borda HTTP. */
function assertPrepaymentAllowed(prepaymentBy: PrepaymentMethod, isNational: boolean) {
  const rejection = prepaymentRejection(prepaymentBy, isNational)
  if (rejection) throw new HttpError(400, rejection)
}

/** Aplica a regra de `domain/packaging.ts` na borda HTTP. */
function assertBoxAssignmentsFit(boxAssignments: BoxAssignments | null | undefined, packageCount: number) {
  if (!boxAssignmentsFit(boxAssignments, packageCount)) {
    throw new HttpError(
      400,
      `A divisão informada tem ${boxAssignments!.length} caixas, mas o pedido declara ${packageCount}. Ajuste o número de caixas.`,
    )
  }
}

// Lembrete é um bônus sobre um pedido que já foi criado com sucesso — se
// isto falhar por qualquer motivo, o pedido não pode ser desfeito por causa
// disso, só logamos e seguimos.
async function createPendingDocsTask(
  userId: string,
  order: { id: string; orderNumber: number },
  quoteNumber: string,
  clientName: string,
  missing: string[],
) {
  try {
    const columns = await ensureColumns(userId)
    const columnId = columns[0].id
    const count = await prisma.personalTask.count({ where: { userId, columnId } })
    await prisma.personalTask.create({
      data: {
        userId,
        title: `Pedido ${formatOrderNumber(order.orderNumber)}: anexar ${missing.join(' e ')}`,
        notes: `Cliente ${clientName} — orçamento ${quoteNumber}`,
        clientName,
        columnId,
        position: count,
        orderId: order.id,
      },
    })
  } catch (err) {
    console.error('[orders] falha ao criar tarefa de pendência pós-pedido:', err)
  }
}

// Fecha o ciclo do passo 6: quando o pedido vira Concluído, a tarefa que o
// próprio sistema criou pra ele (se houver) migra sozinha pra coluna de
// concluído de quem a criou, sem precisar arrastar o card à mão. Silencioso
// por natureza — nem toda tarefa tem uma coluna "concluído" definida, e isso
// não é motivo pra falhar a mudança de status do pedido.
async function moveOrderTasksToDone(orderId: string) {
  try {
    const tasks = await prisma.personalTask.findMany({ where: { orderId }, select: { id: true, userId: true, columnId: true } })
    for (const task of tasks) {
      const doneColumnId = await findDoneColumnId(task.userId)
      if (!doneColumnId || doneColumnId === task.columnId) continue
      const count = await prisma.personalTask.count({ where: { userId: task.userId, columnId: doneColumnId } })
      await prisma.personalTask.update({ where: { id: task.id }, data: { columnId: doneColumnId, position: count } })
    }
  } catch (err) {
    console.error('[orders] falha ao mover tarefa do pedido pra concluído:', err)
  }
}

async function nextOrderNumber() {
  const last = await prisma.order.findFirst({ orderBy: { orderNumber: 'desc' } })
  return last ? last.orderNumber + 1 : env.ORDER_NUMBER_START
}

// `orderNumber` é o único campo único de Order além de `id` (gerado pelo
// servidor, que na prática nunca colide), então qualquer P2002 aqui é disputa
// pelo número do pedido. O `meta.target` do adaptador do Prisma 7 não traz o
// nome do campo de forma confiável — conferido num P2002 real antes de
// depender dele.
function isOrderNumberConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

// <input type="date"> manda "YYYY-MM-DD", sem hora. `z.coerce.date()` faz
// `new Date("YYYY-MM-DD")`, que o JS interpreta como meia-noite UTC — em
// fusos atrás de UTC (Brasil, UTC-3) isso cai no dia anterior assim que
// alguma tela formata a data no fuso local (`toLocaleDateString`). Fixar em
// meio-dia UTC mantém o mesmo dia-calendário em qualquer fuso real do mundo.
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .transform((s) => new Date(`${s}T12:00:00Z`))

export const orderFieldsSchema = z.object({
  quoteId: z.string().min(1),
  purchaseOrder: z.string().optional(),
  orderedByEmail: z.string().email(),
  shipDate: dateOnlySchema.optional(),
  billToText: z.string().min(1),
  shipToText: z.string().min(1),
  shipToNote: z.string().optional(),
  netWeightKg: z.coerce.number().positive().optional(),
  grossWeightKg: z.coerce.number().positive().optional(),
  awbNumber: z.string().optional(),
  incoterms: z.string().optional(),
  shippingMethod: z.string().optional(),
  prepaymentBy: z.enum(['PAYPAL', 'WIRE_TRANSFER', 'PIX']).optional(),
  paypalFee: z.coerce.number().min(0).optional(),
  nfNumber: z.string().optional(),
  nfDate: dateOnlySchema.optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  itemWeightsKg: z.array(z.coerce.number().positive().nullable()).optional(),
  packageCount: z.coerce.number().int().positive().optional(),
  boxAssignments: z
    .array(z.array(z.object({ label: z.string().min(1), quantity: z.number().int().positive() })))
    .optional(),
})
export type OrderFieldsInput = z.infer<typeof orderFieldsSchema>

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
    shippingMethod: string | null
    prepaymentBy: 'PAYPAL' | 'WIRE_TRANSFER' | 'PIX'
    paypalFee: number | null
    nfNumber: string | null
    nfDate: Date | null
    exchangeRate: number | null
    itemWeightsKg: (number | null)[] | null
    packageCount: number
    boxAssignments: BoxAssignments | null
  },
  quote: {
    quoteNumber: string
    currency: string
    exportScope: 'NATIONAL' | 'INTERNATIONAL'
    freight: unknown
    discount: unknown
    items: {
      quantity: number
      unitPrice: unknown
      lineTotal: unknown
      title: string | null
      description: string
      product: { name: string; weightKg: unknown }
    }[]
  },
) {
  const currency = quote.currency
  // Venda nacional não sai do Brasil — sem câmbio, sem declaração de
  // exportação, sem Packing List (o modelo em inglês/estilo invoice). O
  // Invoice e a Packing List Box continuam, mas essa última sai num modelo
  // diferente pra nacional: em português e com o código NCM por item — ver
  // PackingListBoxData.isNational em orderPdf.ts. Escolhido explicitamente
  // no orçamento (Quote.exportScope), não mais inferido da moeda — ver
  // NewQuote.tsx.
  // Venda nacional só gera a Packing List Box — nem Invoice, nem Packing
  // List (inglês), nem Documento de Exportação. Pedido explícito do Daniel:
  // o Invoice nacional (que a gente chegou a traduzir pra PT/BRL) saiu de
  // circulação de novo.
  const isNational = quote.exportScope === 'NATIONAL'
  const freight = quote.freight !== null ? Number(quote.freight) : null
  const discount = Number(quote.discount)

  const docItems = quote.items.map((item) => ({
    // Nome editado no orçamento vence o do catálogo — ver QuoteItem.title.
    title: item.title ?? item.product.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  }))

  const subtotal = docItems.reduce((sum, i) => sum + i.lineTotal, 0)
  const total = invoiceTotal({
    subtotal,
    freight,
    discount,
    prepaymentBy: order.prepaymentBy,
    paypalFee: order.paypalFee,
  })

  // Sem pedido de compra informado, o Invoice usa o número do orçamento de
  // origem — não o número do próprio pedido.
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
    shippingMethod: order.shippingMethod,
    prepaymentBy: order.prepaymentBy,
    nfDate: order.nfDate,
    nfNumber: order.nfNumber,
    isNational,
  }

  const boxData = {
    orderNumber: order.orderNumber,
    shipToText: order.shipToText,
    pages: buildBoxPages(order.packageCount, order.boxAssignments, docItems),
    isNational,
    shippingMethod: order.shippingMethod,
  }

  const exportData = {
    orderNumber: order.orderNumber,
    // Só é montado quando !isNational (ver a chamada condicional abaixo), e
    // nesse caso exchangeRate sempre veio preenchido — nunca null.
    exchangeRate: order.exchangeRate ?? 1,
    currency,
    freight,
    paypalFee: order.prepaymentBy === 'PAYPAL' ? order.paypalFee : null,
    discount: discount > 0 ? discount : null,
    netWeightKg: order.netWeightKg,
    grossWeightKg: order.grossWeightKg,
    packageCount: order.packageCount,
    items: quote.items.map((item, index) => {
      // O peso digitado no pedido vence o peso de catálogo do produto, que
      // com frequência está em branco.
      const manualWeight = order.itemWeightsKg?.[index]
      const weightKgUnit =
        manualWeight !== undefined && manualWeight !== null
          ? manualWeight
          : item.product.weightKg !== null
            ? Number(item.product.weightKg)
            : null
      return {
        code: item.title ?? item.product.name,
        quantity: item.quantity,
        unitPriceUsd: Number(item.unitPrice),
        weightKgUnit,
      }
    }),
  }

  const [invoiceBuffer, packingListBuffer, packingListBoxBuffer, exportDocBuffer] = await Promise.all([
    isNational ? null : generateInvoicePdf(docData),
    isNational ? null : generatePackingListPdf(docData),
    generatePackingListBoxPdf(boxData),
    isNational ? null : generateExportDocXlsx(exportData),
  ])

  const uploadsDir = path.resolve(env.UPLOADS_DIR)
  await fs.mkdir(uploadsDir, { recursive: true })
  const orderNumber = formatOrderNumber(order.orderNumber)
  const filenames = {
    invoice: `Order-${orderNumber}-Invoice.pdf`,
    packingList: `Order-${orderNumber}-PackingList.pdf`,
    packingListBox: `Order-${orderNumber}-PackingListBox.pdf`,
    exportDoc: `Order-${orderNumber}-Export.xlsx`,
  }
  await Promise.all([
    invoiceBuffer && fs.writeFile(path.join(uploadsDir, filenames.invoice), invoiceBuffer),
    packingListBuffer && fs.writeFile(path.join(uploadsDir, filenames.packingList), packingListBuffer),
    packingListBoxBuffer && fs.writeFile(path.join(uploadsDir, filenames.packingListBox), packingListBoxBuffer),
    exportDocBuffer && fs.writeFile(path.join(uploadsDir, filenames.exportDoc), exportDocBuffer),
  ])

  return {
    invoicePdfUrl: invoiceBuffer ? versionedUrlFor(filenames.invoice) : null,
    packingListPdfUrl: packingListBuffer ? versionedUrlFor(filenames.packingList) : null,
    packingListBoxPdfUrl: versionedUrlFor(filenames.packingListBox),
    exportDocXlsxUrl: exportDocBuffer ? versionedUrlFor(filenames.exportDoc) : null,
  }
}

export async function createOrderRecord(data: OrderFieldsInput, requesterId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: data.quoteId }, include: quoteInclude })
  if (!quote) throw new HttpError(404, 'Orçamento não encontrado')
  if (quote.items.length === 0) throw new HttpError(400, 'Este orçamento não possui itens')

  const isNational = quote.exportScope === 'NATIONAL'
  const exchangeRate = isNational
    ? null
    : (data.exchangeRate ??
      (await fetchExchangeRate(quote.currency as 'USD' | 'EUR').catch(() => {
        throw new HttpError(400, 'Não foi possível obter o câmbio automaticamente. Informe o valor manualmente.')
      })))
  const packageCount = data.packageCount ?? 1
  const prepaymentBy = data.prepaymentBy ?? 'WIRE_TRANSFER'
  assertPrepaymentAllowed(prepaymentBy, isNational)
  assertBoxAssignmentsFit(data.boxAssignments, packageCount)

  let order: Awaited<ReturnType<typeof prisma.order.create>> | undefined
  let orderNumber = 0
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) await reservationBackoff(attempt)
    orderNumber = await nextOrderNumber()
    try {
      order = await prisma.order.create({
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
          shippingMethod: data.shippingMethod ?? null,
          itemWeightsKg: data.itemWeightsKg,
          packageCount,
          boxAssignments: data.boxAssignments ?? undefined,
          prepaymentBy,
          paypalFee: data.paypalFee ?? null,
          nfNumber: data.nfNumber ?? null,
          nfDate: data.nfDate ?? null,
          exchangeRate,
          createdById: requesterId,
        },
        include,
      })
      break
    } catch (err) {
      if (isOrderNumberConflict(err)) continue
      throw err
    }
  }
  if (!order) throw new HttpError(409, 'Não foi possível reservar um número de pedido. Tente novamente.')

  const orderForDocs = {
    orderNumber,
    purchaseOrder: data.purchaseOrder ?? null,
    orderedByEmail: data.orderedByEmail,
    invoiceDate: order.invoiceDate,
    billToText: data.billToText,
    shipToText: data.shipToText,
    netWeightKg: data.netWeightKg ?? null,
    grossWeightKg: data.grossWeightKg ?? null,
    awbNumber: data.awbNumber ?? null,
    incoterms: data.incoterms ?? null,
    shippingMethod: data.shippingMethod ?? null,
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

  const missing = missingPostOrderDocs(
    { status: 'PENDING', awbNumber: data.awbNumber ?? null, nfNumber: data.nfNumber ?? null },
    quote.exportScope,
  )
  if (missing.length > 0) {
    await createPendingDocsTask(requesterId, { id: order.id, orderNumber }, quote.quoteNumber, quote.clientName, missing)
  }

  return prisma.order.update({ where: { id: order.id }, data: docUrls, include })
}

ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = orderFieldsSchema.parse(req.body)
    const updated = await createOrderRecord(data, req.user!.id)
    res.status(201).json({ order: await toOrderDTOFresh(updated) })
  }),
)

export async function updateOrderRecord(existingId: string, data: Partial<Omit<OrderFieldsInput, 'quoteId'>>, _requesterId: string) {
  const existing = await prisma.order.findUnique({ where: { id: existingId }, include: { quote: { include: quoteInclude } } })
  if (!existing) throw new HttpError(404, 'Pedido não encontrado')

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
    shippingMethod: data.shippingMethod !== undefined ? data.shippingMethod || null : existing.shippingMethod,
    prepaymentBy: data.prepaymentBy ?? existing.prepaymentBy,
    paypalFee: data.paypalFee !== undefined ? data.paypalFee : existing.paypalFee !== null ? Number(existing.paypalFee) : null,
    nfNumber: data.nfNumber !== undefined ? data.nfNumber || null : existing.nfNumber,
    nfDate: data.nfDate !== undefined ? (data.nfDate ?? null) : existing.nfDate,
    exchangeRate:
      existing.quote.exportScope === 'NATIONAL'
        ? null
        : (data.exchangeRate ?? (existing.exchangeRate !== null ? Number(existing.exchangeRate) : 1)),
    itemWeightsKg: data.itemWeightsKg ?? ((existing.itemWeightsKg as (number | null)[] | null) ?? null),
    packageCount: data.packageCount ?? existing.packageCount,
    boxAssignments: data.boxAssignments ?? ((existing.boxAssignments as BoxAssignments | null) ?? null),
  }

  assertPrepaymentAllowed(merged.prepaymentBy, existing.quote.exportScope === 'NATIONAL')
  assertBoxAssignmentsFit(merged.boxAssignments, merged.packageCount)

  const docUrls = await buildAndWriteDocuments(merged, existing.quote)

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      purchaseOrder: merged.purchaseOrder,
      orderedByEmail: merged.orderedByEmail,
      shipDate: data.shipDate !== undefined ? (data.shipDate ?? null) : existing.shipDate,
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
      shippingMethod: merged.shippingMethod,
      prepaymentBy: merged.prepaymentBy,
      paypalFee: merged.paypalFee,
      nfNumber: merged.nfNumber,
      nfDate: merged.nfDate,
      exchangeRate: merged.exchangeRate,
      ...docUrls,
    },
    include,
  })
  await prisma.$executeRaw`UPDATE orders SET "documentsGeneratedAt" = now() WHERE id = ${order.id}`

  // Preencher AWB/NF por edição resolve a pendência tanto quanto marcar o
  // pedido como Concluído — a tarefa que o sistema criou sozinho não deve
  // ficar esquecida na coluna Pendente só porque ninguém tocou no status.
  const stillMissing = missingPostOrderDocs(
    { status: existing.status, awbNumber: merged.awbNumber, nfNumber: merged.nfNumber },
    existing.quote.exportScope,
  )
  if (stillMissing.length === 0) await moveOrderTasksToDone(existing.id)

  return order
}

ordersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = orderFieldsSchema.omit({ quoteId: true }).partial().parse(req.body)
    const order = await updateOrderRecord(req.params.id, data, req.user!.id)
    res.json({ order: await toOrderDTOFresh(order) })
  }),
)

const statusSchema = z.object({ status: z.enum(['PENDING', 'COMPLETED']) })

// Troca de status é operação leve: diferente do PATCH /:id, nunca regera
// PDF nem planilha (status não muda nada em documento).
ordersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body)
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')

    const order = await prisma.order.update({ where: { id: existing.id }, data: { status }, include })
    if (status === 'COMPLETED') await moveOrderTasksToDone(existing.id)
    res.json({ order: await toOrderDTOFresh(order) })
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
      existing.boletoDocumentUrl,
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
    res.status(201).json({ order: await toOrderDTOFresh(order) })
  }),
)

ordersRouter.post(
  '/:id/boleto-document',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado')
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Pedido não encontrado')
    if (existing.boletoDocumentUrl) deleteStoredFile(existing.boletoDocumentUrl)

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { boletoDocumentUrl: publicUrlFor(req.file.filename) },
      include,
    })
    res.status(201).json({ order: await toOrderDTOFresh(order) })
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
    res.status(201).json({ order: await toOrderDTOFresh(order) })
  }),
)
