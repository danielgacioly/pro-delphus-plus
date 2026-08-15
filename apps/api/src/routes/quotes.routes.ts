import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toQuoteDTO } from '../lib/dto.js'
import { generateQuotePdf } from '../lib/pdf.js'
import { generateQuoteXlsx } from '../lib/xlsx.js'
import { defaultQuoteNotes } from '../lib/quoteI18n.js'
import { env } from '../lib/env.js'
import { deleteStoredFile, storageFilename, versionedUrlFor } from '../storage/local.js'

export const quotesRouter = Router()

quotesRouter.use(requireAuth)

const include = {
  items: { include: { product: true } },
  createdBy: { select: { id: true, name: true } },
  client: { select: { country: true } },
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
    const filePath = path.join(path.resolve(env.UPLOADS_DIR), storageFilename(url))
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
        title: z.string().optional(),
        description: z.string().optional(),
        unitPrice: z.coerce.number().positive().optional(),
      }),
    )
    .min(1),
  freight: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).default(0),
  // Ver o bloqueio de PATCH /:id abaixo — some no create, onde nunca existe
  // um pedido concluído vinculado ainda.
  confirmCompletedOrders: z.boolean().optional(),
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

  // País do cliente vinculado decide Sr./Sra. vs Mr./Ms. no documento — ver
  // clientPrefixLabel em @prodelphusplus/shared. Sem cliente vinculado
  // (nome digitado à mão) não há sinal de nacionalidade, então fica null.
  let clientCountry: string | null = null
  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { country: true } })
    if (!client) throw new HttpError(400, 'Cliente não encontrado')
    clientCountry = client.country
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
      // Both accept a per-item override: o nome digitado no orçamento é
      // guardado no item (`titleOverride`) para que o documento não mude se o
      // produto for renomeado no catálogo depois.
      const titleOverride = item.title?.trim() || null
      const title = titleOverride ?? product.name
      const description = item.description || product.description || ''
      const primaryImage =
        product.media.find((m) => m.type === 'IMAGE' && m.isPrimary) ??
        product.media.filter((m) => m.type === 'IMAGE').sort((a, b) => a.order - b.order)[0]
      const photoDataUri = await photoToDataUri(primaryImage?.url)
      return {
        sku: product.sku,
        productId: product.id,
        title,
        titleOverride,
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

  return { currency, priceTier, lineItems, subtotal, total, notes, signature, clientCountry }
}

async function generateQuoteFiles(quoteNumber: string, data: CreateQuoteInput, resolved: Awaited<ReturnType<typeof resolveQuoteData>>) {
  const { currency, lineItems, subtotal, total, notes, signature, clientCountry } = resolved
  const [pdfBuffer, xlsxBuffer] = await Promise.all([
    generateQuotePdf({
      quoteNumber,
      language: data.language,
      clientPrefix: data.clientPrefix,
      clientName: data.clientName,
      clientCountry,
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
      clientCountry,
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

  return { pdfUrl: versionedUrlFor(pdfFilename), xlsxUrl: versionedUrlFor(xlsxFilename) }
}

// `quoteNumber` is the only unique field on Quote besides `id` (server-generated,
// effectively never collides), so any P2002 here means a quoteNumber race.
// (Prisma 7's driver-adapter errors don't reliably populate `meta.target`
// with the field name — checked against a live P2002 before relying on it.)
function isQuoteNumberConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

quotesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createQuoteSchema.parse(req.body)
    const resolved = await resolveQuoteData(data, req.user!.id)
    const { currency, priceTier, lineItems, subtotal, total, notes } = resolved

    // O número é reservado com um INSERT (rápido) ANTES de gerar o PDF/xlsx
    // (lento — Puppeteer/ExcelJS levam segundos). Antes, o número era só
    // calculado (contagem do dia) e o INSERT só acontecia depois de gerar os
    // arquivos — nessa janela larga, dois orçamentos criados perto um do
    // outro podiam calcular o MESMO número, e o segundo (perdedor da corrida
    // no INSERT, bloqueado pela constraint única) já tinha sobrescrito o
    // arquivo do primeiro no disco antes de falhar. Reservando primeiro, uma
    // colisão falha na hora — antes de qualquer arquivo ser escrito — e a
    // tentativa seguinte pega o próximo número livre.
    let quote: Awaited<ReturnType<typeof prisma.quote.create>> | undefined
    let quoteNumber = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date()
      const datePrefix = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const todayCount = await prisma.quote.count({ where: { quoteNumber: { startsWith: `${datePrefix}-` } } })
      quoteNumber = `${datePrefix}-${String(todayCount + 1).padStart(2, '0')}`
      try {
        quote = await prisma.quote.create({
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
            createdById: req.user!.id,
            items: {
              create: lineItems.map((i) => ({
                sku: i.sku,
                productId: i.productId,
                title: i.titleOverride,
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
        break
      } catch (err) {
        if (isQuoteNumberConflict(err)) continue
        throw err
      }
    }
    if (!quote) throw new HttpError(409, 'Não foi possível reservar um número de orçamento. Tente novamente.')

    const { pdfUrl, xlsxUrl } = await generateQuoteFiles(quoteNumber, data, resolved)
    const updated = await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl, xlsxUrl }, include })

    res.status(201).json({ quote: toQuoteDTO(updated) })
  }),
)

quotesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.quote.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new HttpError(404, 'Orçamento não encontrado')

    const data = createQuoteSchema.parse(req.body)

    // Um pedido "Concluído" já foi entregue/faturado — editar o orçamento de
    // origem muda o total exibido e, na próxima regeneração de documentos,
    // o Invoice também, sem deixar rastro nenhum de que algo mudou depois da
    // conclusão. Em vez de bloquear, exige confirmação explícita informada
    // do que está em jogo (`confirmCompletedOrders`), pedida pelo frontend
    // assim que este erro chega.
    if (!data.confirmCompletedOrders) {
      const completedOrders = await prisma.order.findMany({
        where: { quoteId: existing.id, status: 'COMPLETED' },
        select: { orderNumber: true },
        orderBy: { orderNumber: 'asc' },
      })
      if (completedOrders.length > 0) {
        throw new HttpError(
          409,
          'Este orçamento já tem pedido concluído vinculado. Editar vai mudar os valores desse pedido.',
          { completedOrderNumbers: completedOrders.map((o) => o.orderNumber) },
        )
      }
    }

    const resolved = await resolveQuoteData(data, req.user!.id)
    // Número do orçamento nunca muda — os arquivos regenerados sobrescrevem
    // os antigos no mesmo caminho, então pdfUrl/xlsxUrl também ficam iguais.
    const { pdfUrl, xlsxUrl } = await generateQuoteFiles(existing.quoteNumber, data, resolved)
    const { currency, priceTier, lineItems, subtotal, total, notes } = resolved

    const quote = await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } })
      const updated = await tx.quote.update({
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
              title: i.titleOverride,
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
      // `updatedAt` não está no client tipado (prisma generate não roda
      // neste ambiente) — sem isto, um pedido já gerado a partir deste
      // orçamento nunca saberia que ficou desatualizado (ver
      // toOrderDTOFresh/documentsStale em orders.routes.ts).
      await tx.$executeRaw`UPDATE quotes SET "updatedAt" = now() WHERE id = ${existing.id}`
      return updated
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
