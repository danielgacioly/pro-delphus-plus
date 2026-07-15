import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toQuoteDTO } from '../lib/dto.js'
import { generateQuotePdf } from '../lib/pdf.js'
import { generateQuoteXlsx } from '../lib/xlsx.js'
import { defaultQuoteNotes } from '../lib/quoteI18n.js'
import { env } from '../lib/env.js'

export const quotesRouter = Router()

quotesRouter.use(requireAuth)

const include = { items: { include: { product: true } } } as const

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
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'ADMIN'
    const quotes = await prisma.quote.findMany({
      where: isAdmin ? {} : { createdById: req.user!.id },
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
    if (quote.createdById !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'Acesso não autorizado')
    }
    res.json({ quote: toQuoteDTO(quote) })
  }),
)

const createQuoteSchema = z.object({
  language: z.enum(['PT', 'EN', 'ES']).default('PT'),
  clientPrefix: z.enum(['NONE', 'MR', 'MS']).default('NONE'),
  clientName: z.string().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
  freight: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).default(0),
})

quotesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createQuoteSchema.parse(req.body)
    const currency = data.language === 'PT' ? 'BRL' : 'USD'

    const skus = data.items.map((i) => i.sku)
    const [priceEntries, products, requester] = await Promise.all([
      prisma.priceTableEntry.findMany({ where: { sku: { in: skus }, active: true } }),
      prisma.product.findMany({ where: { sku: { in: skus } }, include: { media: true } }),
      prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } }),
    ])

    const priceBySku = new Map(priceEntries.map((p) => [p.sku, p]))
    const productBySku = new Map(products.map((p) => [p.sku, p]))

    const missing = skus.filter((sku) => {
      const price = priceBySku.get(sku)
      const priceValue = currency === 'BRL' ? price?.priceBRL : price?.priceUSD
      return !priceValue || !productBySku.has(sku)
    })
    if (missing.length > 0) {
      throw new HttpError(
        400,
        `SKU(s) sem preço em ${currency} ou produto cadastrado: ${missing.join(', ')}`,
      )
    }

    const lineItems = await Promise.all(
      data.items.map(async (item) => {
        const price = priceBySku.get(item.sku)!
        const product = productBySku.get(item.sku)!
        const unitPrice = Number(currency === 'BRL' ? price.priceBRL : price.priceUSD)
        const lineTotal = unitPrice * item.quantity
        const primaryImage =
          product.media.find((m) => m.type === 'IMAGE' && m.isPrimary) ??
          product.media.filter((m) => m.type === 'IMAGE').sort((a, b) => a.order - b.order)[0]
        const photoDataUri = await photoToDataUri(primaryImage?.url)
        return {
          sku: item.sku,
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          productName: product.name,
          photoDataUri,
        }
      }),
    )

    const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0)
    const total = subtotal + (data.freight ?? 0) - data.discount

    const now = new Date()
    const datePrefix = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const todayCount = await prisma.quote.count({ where: { quoteNumber: { startsWith: `${datePrefix}-` } } })
    const quoteNumber = `${datePrefix}-${String(todayCount + 1).padStart(2, '0')}`

    const notes = data.notes ?? defaultQuoteNotes(data.language, currency)

    const signature = {
      name: requester.name,
      jobTitle: requester.jobTitle,
      phone: requester.phone,
      email: requester.email,
      signatureImageDataUri: await photoToDataUri(requester.signatureUrl ?? undefined),
    }

    const [pdfBuffer, xlsxBuffer] = await Promise.all([
      generateQuotePdf({
        quoteNumber,
        language: data.language,
        clientPrefix: data.clientPrefix,
        clientName: data.clientName,
        notes,
        items: lineItems.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
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
        items: lineItems.map((i) => ({ sku: i.sku, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })),
        freight: data.freight ?? null,
        discount: data.discount,
        currency,
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

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        language: data.language,
        clientPrefix: data.clientPrefix,
        clientName: data.clientName,
        notes,
        freight: data.freight ?? null,
        discount: data.discount,
        subtotal,
        total,
        pdfUrl: `/uploads/${pdfFilename}`,
        xlsxUrl: `/uploads/${xlsxFilename}`,
        createdById: req.user!.id,
        items: {
          create: lineItems.map((i) => ({
            sku: i.sku,
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include,
    })

    res.status(201).json({ quote: toQuoteDTO(quote) })
  }),
)
