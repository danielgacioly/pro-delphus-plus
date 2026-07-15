import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toProductDTO } from '../lib/dto.js'
import { upload, publicUrlFor, deleteStoredFile } from '../storage/local.js'

export const productsRouter = Router()

productsRouter.use(requireAuth)

const include = { media: true, customizations: true } as const

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = z.string().optional().parse(req.query.search)
    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' as const } },
                { name: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include,
      orderBy: { name: 'asc' },
    })
    res.json({ products: products.map(toProductDTO) })
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

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  weightKg: z.coerce.number().positive().optional(),
})

productsRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body)

    const existing = await prisma.product.findUnique({ where: { sku: data.sku } })
    if (existing) throw new HttpError(409, 'Já existe um produto com este SKU')

    const product = await prisma.product.create({ data, include })
    res.status(201).json({ product: toProductDTO(product) })
  }),
)

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  weightKg: z.coerce.number().positive().optional(),
  active: z.boolean().optional(),
})

productsRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = updateProductSchema.parse(req.body)
    const product = await prisma.product.update({ where: { id: req.params.id }, data, include })
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
