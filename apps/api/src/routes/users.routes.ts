import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toUserDTO } from '../lib/dto.js'

export const usersRouter = Router()

usersRouter.use(requireAuth, requireRole('ADMIN'))

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ users: users.map(toUserDTO) })
  }),
)

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
  phone: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
})

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      throw new HttpError(409, 'Já existe uma conta com este e-mail')
    }

    const { password, ...rest } = data
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { ...rest, passwordHash, status: 'APPROVED' },
    })

    res.status(201).json({ user: toUserDTO(user) })
  }),
)

usersRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
    })
    res.json({ user: toUserDTO(user) })
  }),
)

usersRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    })
    res.json({ user: toUserDTO(user) })
  }),
)

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  active: z.boolean().optional(),
  phone: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
})

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body)

    if (req.params.id === req.user!.id && (data.active === false || data.role === 'USER')) {
      throw new HttpError(400, 'Você não pode remover seu próprio acesso de administrador')
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data })
    res.json({ user: toUserDTO(user) })
  }),
)

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      throw new HttpError(400, 'Você não pode excluir a própria conta')
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!target) throw new HttpError(404, 'Conta não encontrada')
    if (target.role === 'ADMIN') {
      throw new HttpError(400, 'Contas de administrador não podem ser excluídas')
    }

    // Tudo que a conta criou (produtos atualizados, clientes, orçamentos,
    // pedidos) precisa de um dono válido — Quote/Order exigem createdById não
    // nulo. Em vez de bloquear a exclusão por causa disso, o histórico passa
    // para o admin mais antigo (o "principal") antes de apagar a conta.
    const mainAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    })
    if (!mainAdmin) throw new HttpError(500, 'Nenhuma conta de administrador encontrada')

    await prisma.$transaction([
      prisma.product.updateMany({ where: { updatedById: target.id }, data: { updatedById: mainAdmin.id } }),
      prisma.client.updateMany({ where: { createdById: target.id }, data: { createdById: mainAdmin.id } }),
      prisma.quote.updateMany({ where: { createdById: target.id }, data: { createdById: mainAdmin.id } }),
      prisma.order.updateMany({ where: { createdById: target.id }, data: { createdById: mainAdmin.id } }),
      prisma.user.delete({ where: { id: target.id } }),
    ])

    res.status(204).send()
  }),
)

const resetPasswordSchema = z.object({
  password: z.string().min(6),
})

usersRouter.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const { password } = resetPasswordSchema.parse(req.body)
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    })
    res.json({ user: toUserDTO(user) })
  }),
)
