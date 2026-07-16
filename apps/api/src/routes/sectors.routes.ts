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
    const counts = await prisma.product.groupBy({ by: ['sector'], _count: { sector: true } })
    const countBySector = new Map(counts.map((c) => [c.sector, c._count.sector]))
    res.json({
      sectors: sectors.map((s) => ({
        id: s.id,
        name: s.name,
        productCount: countBySector.get(s.name) ?? 0,
      })),
    })
  }),
)

const createSectorSchema = z.object({ name: z.string().trim().min(1) })

sectorsRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createSectorSchema.parse(req.body)
    const existing = await prisma.sector.findUnique({ where: { name: data.name } })
    if (existing) throw new HttpError(409, 'Já existe um setor com este nome')

    const sector = await prisma.sector.create({ data: { name: data.name } })
    res.status(201).json({ sector: { id: sector.id, name: sector.name, productCount: 0 } })
  }),
)

const updateSectorSchema = z.object({ name: z.string().trim().min(1) })

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
    // rename has to be propagated to every product carrying the old name.
    await prisma.$transaction([
      prisma.product.updateMany({ where: { sector: sector.name }, data: { sector: data.name } }),
      prisma.sector.update({ where: { id: sector.id }, data: { name: data.name } }),
    ])

    const productCount = await prisma.product.count({ where: { sector: data.name } })
    res.json({ sector: { id: sector.id, name: data.name, productCount } })
  }),
)

sectorsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const sector = await prisma.sector.findUnique({ where: { id: req.params.id } })
    if (!sector) throw new HttpError(404, 'Setor não encontrado')

    const productCount = await prisma.product.count({ where: { sector: sector.name } })
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
