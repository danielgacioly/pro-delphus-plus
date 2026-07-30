import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'

export const sectorsRouter = Router()

sectorsRouter.use(requireAuth)

sectorsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } })
    // Product.sectors is a scalar array, so counting per sector name happens in JS.
    const products = await prisma.product.findMany({ where: { active: true }, select: { sectors: true } })
    const countBySector = new Map<string, number>()
    for (const product of products) {
      for (const name of product.sectors) {
        countBySector.set(name, (countBySector.get(name) ?? 0) + 1)
      }
    }
    res.json({
      sectors: sectors.map((s) => ({
        id: s.id,
        name: s.name,
        namePt: s.namePt,
        productCount: countBySector.get(s.name) ?? 0,
      })),
    })
  }),
)

const createSectorSchema = z.object({ name: z.string().trim().min(1), namePt: z.string().trim().optional() })

sectorsRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createSectorSchema.parse(req.body)
    const existing = await prisma.sector.findUnique({ where: { name: data.name } })
    if (existing) throw new HttpError(409, 'Já existe um setor com este nome')

    const sector = await prisma.sector.create({ data: { name: data.name, namePt: data.namePt ?? null } })
    res.status(201).json({ sector: { id: sector.id, name: sector.name, namePt: sector.namePt, productCount: 0 } })
  }),
)

const updateSectorSchema = z.object({ name: z.string().trim().min(1), namePt: z.string().trim().optional().nullable() })

sectorsRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = updateSectorSchema.parse(req.body)
    const sector = await prisma.sector.findUnique({ where: { id: req.params.id } })
    if (!sector) throw new HttpError(404, 'Setor não encontrado')

    if (data.name !== sector.name) {
      const existing = await prisma.sector.findUnique({ where: { name: data.name } })
      if (existing) throw new HttpError(409, 'Já existe um setor com este nome')
    }

    // Sector.name isn't a foreign key on Product (kept as free text), so a
    // rename has to be propagated to every product carrying the old name —
    // replacing just that one entry in each product's sectors array.
    await prisma.$transaction([
      prisma.$executeRaw`UPDATE products SET sectors = array_replace(sectors, ${sector.name}, ${data.name}) WHERE ${sector.name} = ANY(sectors)`,
      prisma.sector.update({ where: { id: sector.id }, data: { name: data.name, namePt: data.namePt ?? sector.namePt } }),
    ])

    const productCount = await prisma.product.count({ where: { sectors: { has: data.name } } })
    res.json({ sector: { id: sector.id, name: data.name, namePt: data.namePt ?? sector.namePt, productCount } })
  }),
)

sectorsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const sector = await prisma.sector.findUnique({ where: { id: req.params.id } })
    if (!sector) throw new HttpError(404, 'Setor não encontrado')

    const productCount = await prisma.product.count({ where: { sectors: { has: sector.name } } })
    if (productCount > 0) {
      throw new HttpError(
        409,
        `Este setor tem ${productCount} produto(s) vinculado(s). Mova ou exclua esses produtos antes de remover o setor.`,
      )
    }

    await prisma.sector.delete({ where: { id: sector.id } })
    res.status(204).send()
  }),
)
