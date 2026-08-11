import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toQuoteDTO } from '../lib/dto.js'
import { generateQuotePdf } from '../lib/pdf.js'
import { generateQuoteXlsx } from '../lib/xlsx.js'
import { defaultQuoteNotes } from '../lib/quoteI18n.js'
import { env } from '../lib/env.js'
import { deleteStoredFile } from '../storage/local.js'

export const quotesRouter = Router()

quotesRouter.use(requireAuth)

const include = {
  items: { include: { product: true } },
  createdBy: { select: { id: true, name: true } },
} as const

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

async function photoToDataUri(url: string | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const filePath = path.join(path.resolve(env.UPLOADS_DIR), path.basename(url))
    const buffer = await fs.readFile(filePath)
    const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

quotesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Quotes are visible to every authenticated user, not just their creator or admins.
    const quotes = await prisma.quote.findMany({
      include,
      orderBy: { createdAt: 'desc' },
    })
    res.json({ quotes: quotes.map(toQuoteDTO) })
  }),
)

quotesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const quote = await prisma.quote.findUnique({ where: { id: req.params.id }, include })
    if (!quote) throw new HttpError(404, 'Orçamento não encontrado')
    res.json({ quote: toQuoteDTO(quote) })
  }),
)

const createQuoteSchema = z.object({
  language: z.enum(['PT', 'EN', 'ES']).default('PT'),
  // Optional for backward compatibility — older clients that don't send it
  // fall back to the historical language-implies-currency behavior.
  currency: z.enum(['BRL', 'USD', 'EUR']).optional(),
  priceTier: z.enum(['FINAL', 'DISTRIBUTOR']).default('FINAL'),
  clientPrefix: z.enum(['NONE', 'MR', 'MS']).default('NONE'),
  clientName: z.string().min(1),
  // Vínculo com o cadastro de clientes. Opcional: clientName continua sendo o
  // que vai impresso no documento, e orçamentos avulsos seguem funcionando.
  clientId: z.string().min(1).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        description: z.string().optional(),
        unitPrice: z.coerce.number().positive().optional(),
      }),
    )
    .min(1),
  freight: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).default(0),
})

type CreateQuoteInput = z.infer<typeof createQuoteSchema>

/**
 * Resolve preços/itens/notas/assinatura a partir do payload — compartilhado
 * entre criar e editar orçamento, já que as duas operações fazem exatamente
 * o mesmo cálculo, só divergindo em como o número do orçamento é definido e
 * se é um create ou update no banco.
 */
async function resolveQuoteData(data: CreateQuoteInput, requesterId: string) {
  const currency = data.currency ?? (data.language === 'PT' ? 'BRL' : 'USD')
  // Distributor pricing only exists in USD, so BRL/EUR quotes always use the final price
  const priceTier = currency === 'USD' ? data.priceTier : 'FINAL'

  const priceOf = (product: { priceBRL: unknown; priceUSD: unknown; priceUSDDistributor: unknown; priceEUR: unknown }) => {
    if (currency === 'BRL') return product.priceBRL
    if (currency === 'EUR') return product.priceEUR
    return priceTier === 'DISTRIBUTOR' ? product.priceUSDDistributor : product.priceUSD
  }
  const tierLabel = priceTier === 'DISTRIBUTOR' ? `${currency} (distribuidor)` : currency

  if (data.clientId) {
    const exists = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true } })
    if (!exists) throw new HttpError(400, 'Cliente não encontrado')
  }

  const productIds = data.items.map((i) => i.productId)
  const [products, requester] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, active: true }, include: { media: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: requesterId } }),
  ])

  const productById = new Map(products.map((p) => [p.id, p]))

  const missing = data.items.filter((item) => {
    const product = productById.get(item.productId)
    // A manually entered price covers items with no catalog price for
    // this tier — same escape hatch the description override already has.
    return !product || (!priceOf(product) && item.unitPrice === undefined)
  })
  if (missing.length > 0) {
    const labels = missing.map((item) => productById.get(item.productId)?.sku || item.productId)
    throw new HttpError(400, `Item(ns) sem preço em ${tierLabel} ou produto cadastrado: ${labels.join(', ')}`)
  }

  const lineItems = await Promise.all(
    data.items.map(async (item) => {
      const product = productById.get(item.productId)!
      // O preço de tabela é guardado ao lado do cobrado. Quando os dois
      // diferem, o documento passa a mostrar a coluna de preço especial — daí
      // não bastar sobrescrever `unitPrice` e perder a referência.
      const catalogPrice = priceOf(product)
      const listPrice = catalogPrice === null || catalogPrice === undefined ? null : Number(catalogPrice)
      const unitPrice = item.unitPrice ?? listPrice!
      const lineTotal = unitPrice * item.quantity
      // Title (product name/code) is rendered in bold; the descriptive text follows it.
      // A per-item override replaces the descriptive text only, never the title.
      const title = product.name
      const description = item.description || product.description || ''
      const primaryImage =
        product.media.find((m) => m.type === 'IMAGE' && m.isPrimary) ??
        product.media.filter((m) => m.type === 'IMAGE').sort((a, b) => a.order - b.order)[0]
      const photoDataUri = await photoToDataUri(primaryImage?.url)
      return {
        sku: product.sku,
        productId: product.id,
        title,
        quantity: item.quantity,
        listPrice,
        unitPrice,
        lineTotal,
        description,
        photoDataUri,
      }
    }),
  )

  const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0)
  const total = subtotal + (data.freight ?? 0) - data.discount
  const notes = data.notes ?? defaultQuoteNotes(data.language, currency)

  const signature = {
    name: requester.name,
    jobTitle: requester.jobTitle,
    phone: requester.phone,
    email: requester.email,
    signatureImageDataUri: await photoToDataUri(requester.signatureUrl ?? undefined),
  }

  return { currency, priceTier, lineItems, subtotal, total, notes, signature }
}

async function generateQuoteFiles(quoteNumber: string, data: CreateQuoteInput, resolved: Awaited<ReturnType<typeof resolveQuoteData>>) {
  const { currency, lineItems, subtotal, total, notes, signature } = resolved
  const [pdfBuffer, xlsxBuffer] = await Promise.all([
    generateQuotePdf({
      quoteNumber,
      language: data.language,
      clientPrefix: data.clientPrefix,
      clientName: data.clientName,
      notes,
      items: lineItems.map((i) => ({
        title: i.title,
        description: i.description,
        quantity: i.quantity,
        listPrice: i.listPrice,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        photoDataUri: i.photoDataUri,
      })),
      freight: data.freight ?? null,
      discount: data.discount,
      subtotal,
      total,
      currency,
      signature,
    }),
    generateQuoteXlsx({
      quoteNumber,
      language: data.language,
      clientPrefix: data.clientPrefix,
      clientName: data.clientName,
      notes,
      items: lineItems.map((i) => ({
        title: i.title,
        description: i.description,
        quantity: i.quantity,
        listPrice: i.listPrice,
        unitPrice: i.unitPrice,
        photoDataUri: i.photoDataUri,
      })),
      freight: data.freight ?? null,
      discount: data.discount,
      subtotal,
      total,
      currency,
      signature,
    }),
  ])

  const uploadsDir = path.resolve(env.UPLOADS_DIR)
  await fs.mkdir(uploadsDir, { recursive: true })
  const pdfFilename = `Quote-${quoteNumber}.pdf`
  const xlsxFilename = `Quote-${quoteNumber}.xlsx`
  await Promise.all([
    fs.writeFile(path.join(uploadsDir, pdfFilename), pdfBuffer),
    fs.writeFile(path.join(uploadsDir, xlsxFilename), xlsxBuffer),
  ])

  return { pdfUrl: `/uploads/${pdfFilename}`, xlsxUrl: `/uploads/${xlsxFilename}` }
}

quotesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createQuoteSchema.parse(req.body)
    const resolved = await resolveQuoteData(data, req.user!.id)

    const now = new Date()
    const datePrefix = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const todayCount = await prisma.quote.count({ where: { quoteNumber: { startsWith: `${datePrefix}-` } } })
    const quoteNumber = `${datePrefix}-${String(todayCount + 1).padStart(2, '0')}`

    const { pdfUrl, xlsxUrl } = await generateQuoteFiles(quoteNumber, data, resolved)
    const { currency, priceTier, lineItems, subtotal, total, notes } = resolved

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        language: data.language,
        currency,
        priceTier,
        clientPrefix: data.clientPrefix,
        clientName: data.clientName,
        clientId: data.clientId ?? null,
        notes,
        freight: data.freight ?? null,
        discount: data.discount,
        subtotal,
        total,
        pdfUrl,
        xlsxUrl,
        createdById: req.user!.id,
        items: {
          create: lineItems.map((i) => ({
            sku: i.sku,
            productId: i.productId,
            quantity: i.quantity,
            listPrice: i.listPrice,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            description: i.description,
          })),
        },
      },
      include,
    })

    res.status(201).json({ quote: toQuoteDTO(quote) })
  }),
)

quotesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.quote.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Orçamento não encontrado')

    const data = createQuoteSchema.parse(req.body)
    const resolved = await resolveQuoteData(data, req.user!.id)
    // Número do orçamento nunca muda — os arquivos regenerados sobrescrevem
    // os antigos no mesmo caminho, então pdfUrl/xlsxUrl também ficam iguais.
    const { pdfUrl, xlsxUrl } = await generateQuoteFiles(existing.quoteNumber, data, resolved)
    const { currency, priceTier, lineItems, subtotal, total, notes } = resolved

    const quote = await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } })
      return tx.quote.update({
        where: { id: existing.id },
        data: {
          language: data.language,
          currency,
          priceTier,
          clientPrefix: data.clientPrefix,
          clientName: data.clientName,
          clientId: data.clientId ?? null,
          notes,
          freight: data.freight ?? null,
          discount: data.discount,
          subtotal,
          total,
          pdfUrl,
          xlsxUrl,
          items: {
            create: lineItems.map((i) => ({
              sku: i.sku,
              productId: i.productId,
              quantity: i.quantity,
              listPrice: i.listPrice,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
              description: i.description,
            })),
          },
        },
        include,
      })
    })

    res.json({ quote: toQuoteDTO(quote) })
  }),
)

quotesRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.quote.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Orçamento não encontrado')

    // Um pedido gerado a partir do orçamento depende dele (Order.quoteId é
    // obrigatório) — apagar o orçamento primeiro deixaria o pedido órfão.
    const hasOrder = await prisma.order.findFirst({ where: { quoteId: existing.id }, select: { id: true } })
    if (hasOrder) throw new HttpError(400, 'Este orçamento já virou pedido e não pode ser excluído. Exclua o pedido primeiro.')

    if (existing.pdfUrl) deleteStoredFile(existing.pdfUrl)
    if (existing.xlsxUrl) deleteStoredFile(existing.xlsxUrl)

    await prisma.quote.delete({ where: { id: existing.id } })
    res.status(204).send()
  }),
)
