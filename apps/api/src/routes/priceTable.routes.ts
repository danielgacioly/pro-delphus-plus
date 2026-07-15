import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toPriceTableEntryDTO } from '../lib/dto.js'

export const priceTableRouter = Router()

priceTableRouter.use(requireAuth)

const listQuerySchema = z.object({
  search: z.string().optional(),
})

priceTableRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search } = listQuerySchema.parse(req.query)

    const entries = await prisma.priceTableEntry.findMany({
      where: {
        active: true,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { sector: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sector: 'asc' }, { sku: 'asc' }],
    })

    res.json({ entries: entries.map(toPriceTableEntryDTO) })
  }),
)

priceTableRouter.get(
  '/sectors',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.priceTableEntry.findMany({
      distinct: ['sector'],
      select: { sector: true },
      orderBy: { sector: 'asc' },
    })
    res.json({ sectors: rows.map((r) => r.sector) })
  }),
)

const createEntrySchema = z
  .object({
    sku: z.string().min(1),
    sector: z.string().min(1),
    description: z.string().min(1),
    priceBRL: z.coerce.number().positive().optional(),
    priceUSD: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.priceBRL !== undefined || data.priceUSD !== undefined, {
    message: 'Informe ao menos um preço (BRL ou USD)',
  })

priceTableRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createEntrySchema.parse(req.body)

    const existing = await prisma.priceTableEntry.findUnique({ where: { sku: data.sku } })
    if (existing) {
      throw new HttpError(409, 'Já existe um preço cadastrado para este SKU')
    }

    const entry = await prisma.priceTableEntry.create({
      data: { ...data, updatedById: req.user!.id },
    })
    res.status(201).json({ entry: toPriceTableEntryDTO(entry) })
  }),
)

const updateEntrySchema = z.object({
  sector: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priceBRL: z.coerce.number().positive().optional().nullable(),
  priceUSD: z.coerce.number().positive().optional().nullable(),
  active: z.boolean().optional(),
})

priceTableRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = updateEntrySchema.parse(req.body)
    const entry = await prisma.priceTableEntry.update({
      where: { id: req.params.id },
      data: { ...data, updatedById: req.user!.id },
    })
    res.json({ entry: toPriceTableEntryDTO(entry) })
  }),
)

priceTableRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.priceTableEntry.delete({ where: { id: req.params.id } })
    res.status(204).send()
  }),
)
