import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toPersonalBoardColumnDTO, toPersonalTaskDTO } from '../lib/dto.js'

export const tasksRouter = Router()

tasksRouter.use(requireAuth)

const DEFAULT_COLUMNS = ['Pendente', 'Em andamento', 'Concluído']

async function ensureColumns(userId: string) {
  const existing = await prisma.personalBoardColumn.findMany({ where: { userId }, orderBy: { position: 'asc' } })
  if (existing.length > 0) return existing

  await prisma.personalBoardColumn.createMany({
    data: DEFAULT_COLUMNS.map((name, position) => ({ userId, name, position })),
  })
  return prisma.personalBoardColumn.findMany({ where: { userId }, orderBy: { position: 'asc' } })
}

tasksRouter.get(
  '/board-columns',
  asyncHandler(async (req, res) => {
    const columns = await ensureColumns(req.user!.id)
    res.json({ columns: columns.map(toPersonalBoardColumnDTO) })
  }),
)

const createColumnSchema = z.object({ name: z.string().trim().min(1) })

tasksRouter.post(
  '/board-columns',
  asyncHandler(async (req, res) => {
    const data = createColumnSchema.parse(req.body)
    const existing = await prisma.personalBoardColumn.findMany({ where: { userId: req.user!.id } })
    const position = existing.length ? Math.max(...existing.map((c) => c.position)) + 1 : 0

    const column = await prisma.personalBoardColumn.create({
      data: { userId: req.user!.id, name: data.name, position },
    })
    res.status(201).json({ column: toPersonalBoardColumnDTO(column) })
  }),
)

const updateColumnSchema = z.object({ name: z.string().trim().min(1).optional(), position: z.number().int().optional() })

tasksRouter.patch(
  '/board-columns/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.personalBoardColumn.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.userId !== req.user!.id) throw new HttpError(404, 'Quadro não encontrado')

    const data = updateColumnSchema.parse(req.body)
    const column = await prisma.personalBoardColumn.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.position !== undefined && { position: data.position }),
      },
    })
    res.json({ column: toPersonalBoardColumnDTO(column) })
  }),
)

tasksRouter.delete(
  '/board-columns/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.personalBoardColumn.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.userId !== req.user!.id) throw new HttpError(404, 'Quadro não encontrado')

    const taskCount = await prisma.personalTask.count({ where: { columnId: existing.id } })
    if (taskCount > 0) {
      throw new HttpError(409, `Este quadro tem ${taskCount} tarefa(s). Mova ou exclua as tarefas antes de remover o quadro.`)
    }

    await prisma.personalBoardColumn.delete({ where: { id: existing.id } })
    res.status(204).send()
  }),
)

const taskInclude = { quote: { select: { quoteNumber: true } }, order: { select: { orderNumber: true } } } as const

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await ensureColumns(req.user!.id)
    const tasks = await prisma.personalTask.findMany({
      where: { userId: req.user!.id },
      include: taskInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
    res.json({ tasks: tasks.map(toPersonalTaskDTO) })
  }),
)

tasksRouter.get(
  '/clients',
  asyncHandler(async (req, res) => {
    const rows = await prisma.personalTask.findMany({
      where: { userId: req.user!.id, clientName: { not: null } },
      select: { clientName: true },
      distinct: ['clientName'],
    })
    res.json({ clients: rows.map((r) => r.clientName!).sort() })
  }),
)

tasksRouter.get(
  '/tags',
  asyncHandler(async (req, res) => {
    const rows = await prisma.personalTask.findMany({
      where: { userId: req.user!.id },
      select: { tags: true },
    })
    const tags = new Set<string>()
    for (const row of rows) for (const tag of row.tags) tags.add(tag)
    res.json({ tags: Array.from(tags).sort() })
  }),
)

const createSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  clientName: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  dueDate: z.coerce.date().optional(),
  columnId: z.string().optional(),
  quoteId: z.string().optional(),
  orderId: z.string().optional(),
})

tasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body)
    const columns = await ensureColumns(req.user!.id)

    const columnId = data.columnId ?? columns[0].id
    const column = columns.find((c) => c.id === columnId)
    if (!column) throw new HttpError(400, 'Quadro inválido')

    const count = await prisma.personalTask.count({ where: { userId: req.user!.id, columnId } })

    const task = await prisma.personalTask.create({
      data: {
        userId: req.user!.id,
        title: data.title,
        notes: data.notes || null,
        clientName: data.clientName || null,
        tags: data.tags ?? [],
        dueDate: data.dueDate ?? null,
        columnId,
        position: count,
        quoteId: data.quoteId || null,
        orderId: data.orderId || null,
      },
      include: taskInclude,
    })
    res.status(201).json({ task: toPersonalTaskDTO(task) })
  }),
)

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  tags: z.array(z.string().min(1)).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  columnId: z.string().optional(),
  position: z.number().int().optional(),
  quoteId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
})

tasksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.personalTask.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.userId !== req.user!.id) throw new HttpError(404, 'Tarefa não encontrada')

    const data = updateSchema.parse(req.body)

    if (data.columnId !== undefined) {
      const column = await prisma.personalBoardColumn.findUnique({ where: { id: data.columnId } })
      if (!column || column.userId !== req.user!.id) throw new HttpError(400, 'Quadro inválido')
    }

    const task = await prisma.personalTask.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.clientName !== undefined && { clientName: data.clientName || null }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.columnId !== undefined && { columnId: data.columnId }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.quoteId !== undefined && { quoteId: data.quoteId || null }),
        ...(data.orderId !== undefined && { orderId: data.orderId || null }),
      },
      include: taskInclude,
    })
    res.json({ task: toPersonalTaskDTO(task) })
  }),
)

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.personalTask.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.userId !== req.user!.id) throw new HttpError(404, 'Tarefa não encontrada')

    await prisma.personalTask.delete({ where: { id: existing.id } })
    res.status(204).send()
  }),
)
