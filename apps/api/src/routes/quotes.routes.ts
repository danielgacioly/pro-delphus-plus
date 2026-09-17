import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toQuoteDTO } from '../lib/dto.js'
import { generateQuotePdf } from '../lib/pdf.js'
import { generateQuoteXlsx } from '../lib/xlsx.js'
import { defaultQuoteNotes, formatMoney } from '../lib/quoteI18n.js'
import { reservationBackoff } from '../lib/numbering.js'
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

// sharp lê estes formatos rasterizados; SVG (e o fallback application/octet-
// stream de algo fora do mapa acima) fica fora — não faz sentido reamostrar
// vetor, e um arquivo de tipo desconhecido pode nem ser imagem de verdade.
const RESIZABLE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

// A foto de item e a assinatura do usuário são embutidas por INTEIRO em todo
// PDF/XLSX de orçamento gerado — a cada geração, de novo. O original enviado
// (foto de celular: alguns MB) nunca aparece maior que 56px no PDF ou 40px no
// XLSX (ver pdf.ts/xlsx.ts), então guardar essa resolução ali é desperdício
// puro que se multiplica por orçamento. 400px cobre até uma tela retina com
// folga; o arquivo original em si (usado no catálogo) não é tocado.
const MAX_EMBED_DIMENSION = 400

async function photoToDataUri(url: string | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const filePath = path.join(path.resolve(env.UPLOADS_DIR), storageFilename(url))
    const buffer = await fs.readFile(filePath)
    const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'

    if (RESIZABLE_MIME.has(mime)) {
      try {
        const resized = await sharp(buffer)
          .resize({
            width: MAX_EMBED_DIMENSION,
            height: MAX_EMBED_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer()
        return `data:${mime};base64,${resized.toString('base64')}`
      } catch {
        // Arquivo no formato certo mas que o sharp não conseguiu processar
        // (corrompido, variante exótica) — cai pro original em vez de perder
        // a foto no orçamento.
      }
    }

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

export const createQuoteSchema = z.object({
  exportScope: z.enum(['NATIONAL', 'INTERNATIONAL']).default('INTERNATIONAL'),
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
        // Teto alto o bastante para qualquer venda real e baixo o bastante para
        // o total caber em Decimal(12,2) — sem ele, um zero a mais estourava o
        // tipo no Postgres e a resposta virava "500 Erro interno".
        quantity: z.coerce.number().int().positive().max(100_000, 'Quantidade acima do limite (100.000)'),
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

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>

/**
 * Resolve preços/itens/notas/assinatura a partir do payload — compartilhado
 * entre criar e editar orçamento, já que as duas operações fazem exatamente
 * o mesmo cálculo, só divergindo em como o número do orçamento é definido e
 * se é um create ou update no banco.
 */
export async function resolveQuoteData(data: CreateQuoteInput, requesterId: string) {
  // Nacional é sempre BRL/português — não é mais o idioma que decide a
  // moeda, é o tipo (Nacional/Internacional) escolhido explicitamente no
  // formulário. Ver NewQuote.tsx.
  const isNational = data.exportScope === 'NATIONAL'
  const language = isNational ? 'PT' : data.language
  const currency = isNational ? 'BRL' : (data.currency ?? 'USD')
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
      // Catálogo tem descrição em PT para a maioria dos produtos — orçamento
      // em português deve puxar dela antes de cair para o inglês, senão o
      // documento sai com texto em inglês mesmo com "Idioma: Português".
      const catalogDescription = language === 'PT' ? product.descriptionPt || product.description : product.description
      const description = item.description || catalogDescription || ''
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
  const freight = data.freight ?? 0
  // Desconto maior que o que há para descontar deixava o orçamento com total
  // negativo, sem aviso nenhum — e o número seguia para o Invoice e para as
  // métricas (receita cotada ficava negativa). É quase sempre um dígito a mais
  // digitado por engano.
  if (data.discount > subtotal + freight) {
    throw new HttpError(
      400,
      `Desconto (${formatMoney(data.discount, currency, language)}) maior que o valor do orçamento (${formatMoney(subtotal + freight, currency, language)}).`,
    )
  }
  const total = subtotal + freight - data.discount
  // Decimal(12,2) no banco: acima disso o INSERT falha lá embaixo com erro de
  // overflow, que chegava ao usuário como "500 Erro interno".
  const MAX_DECIMAL_12_2 = 9_999_999_999.99
  if (subtotal > MAX_DECIMAL_12_2 || total > MAX_DECIMAL_12_2) {
    throw new HttpError(400, 'Valor total do orçamento excede o limite suportado pelo sistema.')
  }
  const notes = data.notes ?? defaultQuoteNotes(language, currency, data.exportScope)

  const signature = {
    name: requester.name,
    jobTitle: requester.jobTitle,
    phone: requester.phone,
    whatsapp: requester.whatsapp,
    email: requester.email,
    signatureImageDataUri: await photoToDataUri(requester.signatureUrl ?? undefined),
  }

  return { language, currency, priceTier, lineItems, subtotal, total, notes, signature, clientCountry }
}

async function generateQuoteFiles(quoteNumber: string, data: CreateQuoteInput, resolved: Awaited<ReturnType<typeof resolveQuoteData>>) {
  const { language, currency, lineItems, subtotal, total, notes, signature, clientCountry } = resolved
  const [pdfBuffer, xlsxBuffer] = await Promise.all([
    generateQuotePdf({
      quoteNumber,
      language,
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
      language,
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

export async function completedOrdersFor(quoteId: string) {
  return prisma.order.findMany({
    where: { quoteId, status: 'COMPLETED' },
    select: { orderNumber: true },
    orderBy: { orderNumber: 'asc' },
  })
}

export async function createQuoteRecord(data: CreateQuoteInput, requesterId: string) {
  const resolved = await resolveQuoteData(data, requesterId)
  const { language, currency, priceTier, lineItems, subtotal, total, notes } = resolved

  let quote: Awaited<ReturnType<typeof prisma.quote.create>> | undefined
  let quoteNumber = ''
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) await reservationBackoff(attempt)
    const now = new Date()
    const datePrefix = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const todayCount = await prisma.quote.count({ where: { quoteNumber: { startsWith: `${datePrefix}-` } } })
    quoteNumber = `${datePrefix}-${String(todayCount + 1).padStart(2, '0')}`
    try {
      quote = await prisma.quote.create({
        data: {
          quoteNumber,
          language,
          currency,
          exportScope: data.exportScope,
          priceTier,
          clientPrefix: data.clientPrefix,
          clientName: data.clientName,
          clientId: data.clientId ?? null,
          notes,
          freight: data.freight ?? null,
          discount: data.discount,
          subtotal,
          total,
          createdById: requesterId,
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
  return prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl, xlsxUrl }, include })
}

export async function updateQuoteRecord(existingId: string, data: CreateQuoteInput, requesterId: string) {
  const existing = await prisma.quote.findUnique({ where: { id: existingId } })
  if (!existing) throw new HttpError(404, 'Orçamento não encontrado')

  const resolved = await resolveQuoteData(data, requesterId)
  const { pdfUrl, xlsxUrl } = await generateQuoteFiles(existing.quoteNumber, data, resolved)
  const { language, currency, priceTier, lineItems, subtotal, total, notes } = resolved

  return prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } })
    const updated = await tx.quote.update({
      where: { id: existing.id },
      data: {
        language,
        currency,
        exportScope: data.exportScope,
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
    await tx.$executeRaw`UPDATE quotes SET "updatedAt" = now() WHERE id = ${existing.id}`
    return updated
  })
}

quotesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createQuoteSchema.parse(req.body)
    const quote = await createQuoteRecord(data, req.user!.id)
    res.status(201).json({ quote: toQuoteDTO(quote) })
  }),
)

quotesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = createQuoteSchema.parse(req.body)

    if (!data.confirmCompletedOrders) {
      const completedOrders = await completedOrdersFor(req.params.id)
      if (completedOrders.length > 0) {
        throw new HttpError(
          409,
          'Este orçamento já tem pedido concluído vinculado. Editar vai mudar os valores desse pedido.',
          { completedOrderNumbers: completedOrders.map((o) => o.orderNumber) },
        )
      }
    }

    const quote = await updateQuoteRecord(req.params.id, data, req.user!.id)
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
