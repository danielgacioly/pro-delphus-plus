import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toProductDTO } from '../lib/dto.js'
import { upload, publicUrlFor, deleteStoredFile } from '../storage/local.js'
import { generatePriceListPdf } from '../lib/priceListPdf.js'

export const productsRouter = Router()

productsRouter.use(requireAuth)

const include = { media: true, brochures: true, customizations: true } as const

// Sectors live in a scalar array on Product, which Prisma can only filter by
// exact membership (`has`) — not substring. The catalog is small (~500 rows),
// so free-text search across sku/name/sectors/description is done in JS instead.
function matchesSearch(
  product: { sku: string; name: string; sectors: string[]; description: string | null },
  needle: string,
) {
  const q = needle.toLowerCase()
  return (
    product.sku.toLowerCase().includes(q) ||
    product.name.toLowerCase().includes(q) ||
    product.sectors.some((s) => s.toLowerCase().includes(q)) ||
    (product.description ?? '').toLowerCase().includes(q)
  )
}

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = z.string().optional().parse(req.query.search)
    const products = await prisma.product.findMany({
      where: { active: true },
      include,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    })
    const filtered = search ? products.filter((p) => matchesSearch(p, search)) : products
    res.json({ products: filtered.map(toProductDTO) })
  }),
)

productsRouter.get(
  '/sectors',
  asyncHandler(async (_req, res) => {
    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } })
    res.json({ sectors: sectors.map((s) => s.name) })
  }),
)

const priceListPdfQuerySchema = z.object({
  search: z.string().optional(),
  description: z.enum(['0', '1']).optional(),
  components: z.enum(['0', '1']).optional(),
  brl: z.enum(['0', '1']).optional(),
  usd: z.enum(['0', '1']).optional(),
  eur: z.enum(['0', '1']).optional(),
  usdDistributor: z.enum(['0', '1']).optional(),
})

productsRouter.get(
  '/price-list-pdf',
  asyncHandler(async (req, res) => {
    const query = priceListPdfQuerySchema.parse(req.query)
    const search = query.search?.trim() || undefined

    const allProducts = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    })
    const products = search ? allProducts.filter((p) => matchesSearch(p, search)) : allProducts

    const pdf = await generatePriceListPdf({
      products: products.map((p) => ({
        sku: p.sku,
        name: p.name,
        description: p.description,
        components: p.components,
        sectors: p.sectors,
        kind: p.kind,
        priceBRL: p.priceBRL?.toString() ?? null,
        priceUSD: p.priceUSD?.toString() ?? null,
        priceEUR: p.priceEUR?.toString() ?? null,
        priceUSDDistributor: p.priceUSDDistributor?.toString() ?? null,
      })),
      columns: {
        description: query.description !== '0',
        components: query.components !== '0',
        brl: query.brl !== '0',
        usd: query.usd !== '0',
        eur: query.eur !== '0',
        usdDistributor: query.usdDistributor === '1',
      },
      search: search ?? null,
      generatedAt: new Date(),
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="tabela-de-precos.pdf"')
    res.send(pdf)
  }),
)

productsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include })
    if (!product) throw new HttpError(404, 'Produto não encontrado')
    res.json({ product: toProductDTO(product) })
  }),
)

// Preço é opcional no cadastro: produtos novos costumam entrar no catálogo antes
// de a precificação fechar. Sem preço, o item simplesmente não aparece com valor
// na tabela e não pode ser orçado até ser preenchido.
const createProductSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  descriptionPt: z.string().optional(),
  components: z.string().optional(),
  componentsPt: z.string().optional(),
  sectors: z.array(z.string().min(1)).min(1),
  videoLinks: z.array(z.string().min(1)).optional(),
  kind: z.enum(['COMPLETE_MODEL', 'COMPONENT']).default('COMPLETE_MODEL'),
  weightKg: z.coerce.number().positive().optional(),
  priceBRL: z.coerce.number().positive().optional(),
  priceUSD: z.coerce.number().positive().optional(),
  priceUSDDistributor: z.coerce.number().positive().optional(),
  priceEUR: z.coerce.number().positive().optional(),
})

productsRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body)

    const product = await prisma.product.create({
      data: { ...data, sku: data.sku ?? '', updatedById: req.user!.id },
      include,
    })
    res.status(201).json({ product: toProductDTO(product) })
  }),
)

const updateProductSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  descriptionPt: z.string().optional(),
  components: z.string().optional(),
  componentsPt: z.string().optional(),
  sectors: z.array(z.string().min(1)).min(1).optional(),
  videoLinks: z.array(z.string().min(1)).optional(),
  kind: z.enum(['COMPLETE_MODEL', 'COMPONENT']).optional(),
  weightKg: z.coerce.number().positive().optional().nullable(),
  priceBRL: z.coerce.number().positive().optional().nullable(),
  priceUSD: z.coerce.number().positive().optional().nullable(),
  priceUSDDistributor: z.coerce.number().positive().optional().nullable(),
  priceEUR: z.coerce.number().positive().optional().nullable(),
  active: z.boolean().optional(),
})

productsRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = updateProductSchema.parse(req.body)

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { ...data, updatedById: req.user!.id },
      include,
    })
    res.json({ product: toProductDTO(product) })
  }),
)

productsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const usedInQuotes = await prisma.quoteItem.findFirst({ where: { productId: req.params.id } })
    if (usedInQuotes) {
      await prisma.product.update({ where: { id: req.params.id }, data: { active: false } })
      return res.json({ message: 'Produto possui orçamentos vinculados e foi desativado em vez de excluído' })
    }
    await prisma.product.delete({ where: { id: req.params.id } })
    res.status(204).send()
  }),
)

productsRouter.post(
  '/:id/media',
  requireRole('ADMIN'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado')

    const type = req.file.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT'
    const count = await prisma.productMedia.count({ where: { productId: req.params.id } })

    const media = await prisma.productMedia.create({
      data: {
        productId: req.params.id,
        url: publicUrlFor(req.file.filename),
        type,
        order: count,
        isPrimary: count === 0 && type === 'IMAGE',
      },
    })

    res.status(201).json({ media })
  }),
)

productsRouter.post(
  '/:id/media/:mediaId/primary',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const media = await prisma.productMedia.findUnique({ where: { id: req.params.mediaId } })
    if (!media || media.productId !== req.params.id) throw new HttpError(404, 'Arquivo não encontrado')
    if (media.type !== 'IMAGE') throw new HttpError(400, 'Apenas imagens podem ser a mídia principal')

    await prisma.$transaction([
      prisma.productMedia.updateMany({ where: { productId: req.params.id }, data: { isPrimary: false } }),
      prisma.productMedia.update({ where: { id: req.params.mediaId }, data: { isPrimary: true } }),
    ])

    res.status(204).send()
  }),
)

productsRouter.delete(
  '/:id/media/:mediaId',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const media = await prisma.productMedia.findUnique({ where: { id: req.params.mediaId } })
    if (!media) throw new HttpError(404, 'Arquivo não encontrado')

    await prisma.productMedia.delete({ where: { id: req.params.mediaId } })
    deleteStoredFile(media.url)

    if (media.isPrimary) {
      const nextImage = await prisma.productMedia.findFirst({
        where: { productId: req.params.id, type: 'IMAGE' },
        orderBy: { order: 'asc' },
      })
      if (nextImage) {
        await prisma.productMedia.update({ where: { id: nextImage.id }, data: { isPrimary: true } })
      }
    }

    res.status(204).send()
  }),
)

productsRouter.post(
  '/:id/brochures',
  requireRole('ADMIN'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado')

    const count = await prisma.productBrochure.count({ where: { productId: req.params.id } })

    const brochure = await prisma.productBrochure.create({
      data: {
        productId: req.params.id,
        url: publicUrlFor(req.file.filename),
        name: req.file.originalname,
        order: count,
      },
    })

    res.status(201).json({ brochure })
  }),
)

productsRouter.delete(
  '/:id/brochures/:brochureId',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const brochure = await prisma.productBrochure.findUnique({ where: { id: req.params.brochureId } })
    if (!brochure) throw new HttpError(404, 'Arquivo não encontrado')

    await prisma.productBrochure.delete({ where: { id: req.params.brochureId } })
    deleteStoredFile(brochure.url)

    res.status(204).send()
  }),
)

const createCustomizationSchema = z.object({
  name: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
})

productsRouter.post(
  '/:id/customizations',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createCustomizationSchema.parse(req.body)
    const customization = await prisma.productCustomization.create({
      data: { productId: req.params.id, name: data.name, options: data.options },
    })
    res.status(201).json({ customization })
  }),
)

productsRouter.delete(
  '/:id/customizations/:customizationId',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.productCustomization.delete({ where: { id: req.params.customizationId } })
    res.status(204).send()
  }),
)
