import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { toUserDTO } from '../lib/dto.js'
import { upload, publicUrlFor, deleteStoredFile } from '../storage/local.js'

export const authRouter = Router()

const REFRESH_COOKIE = 'pd_refresh_token'
const isProd = process.env.NODE_ENV === 'production'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new HttpError(401, 'Credenciais inválidas')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw new HttpError(401, 'Credenciais inválidas')
    }

    if (user.status === 'PENDING') {
      throw new HttpError(403, 'Sua conta ainda está aguardando aprovação do administrador')
    }
    if (user.status === 'REJECTED') {
      throw new HttpError(403, 'Seu cadastro não foi aprovado. Fale com o administrador')
    }
    if (!user.active) {
      throw new HttpError(403, 'Sua conta está desativada. Fale com o administrador')
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role })
    const refreshToken = signRefreshToken({ sub: user.id })

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // Path '/' (e não '/api/auth') de propósito: o navegador precisa enviar
      // este cookie também nas requisições de /uploads, que passaram a exigir
      // sessão — fotos em <img> e PDFs abertos em nova aba não têm como
      // carregar um header Authorization.
      path: '/',
    })

    res.json({ accessToken, user: toUserDTO(user) })
  }),
)

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
})

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      throw new HttpError(409, 'Já existe uma conta com este e-mail')
    }

    const passwordHash = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone,
        jobTitle: data.jobTitle,
        role: 'USER',
        status: 'PENDING',
      },
    })

    res.status(201).json({ user: toUserDTO(user) })
  }),
)

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) {
      throw new HttpError(401, 'Sessão expirada')
    }

    let payload: { sub: string }
    try {
      payload = verifyRefreshToken(token)
    } catch {
      throw new HttpError(401, 'Sessão expirada')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.active || user.status !== 'APPROVED') {
      throw new HttpError(401, 'Sessão expirada')
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role })
    res.json({ accessToken, user: toUserDTO(user) })
  }),
)

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/' })
  // Sessões antigas gravaram o cookie com path '/api/auth'; limpar só o path
  // novo deixaria esse resquício válido para o refresh — logout que não desloga.
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  res.status(204).send()
})

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user || !user.active || user.status !== 'APPROVED') {
      throw new HttpError(401, 'Sessão inválida')
    }
    res.json({ user: toUserDTO(user) })
  }),
)

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional().nullable(),
  jobTitle: z.string().min(1).optional().nullable(),
  catalogLanguage: z.enum(['EN', 'PT']).optional(),
})

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateMeSchema.parse(req.body)

    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } })
      if (existing && existing.id !== req.user!.id) {
        throw new HttpError(409, 'Já existe uma conta com este e-mail')
      }
    }

    const user = await prisma.user.update({ where: { id: req.user!.id }, data })
    res.json({ user: toUserDTO(user) })
  }),
)

authRouter.post(
  '/me/signature',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado')
    if (!req.file.mimetype.startsWith('image/')) {
      throw new HttpError(400, 'A assinatura precisa ser uma imagem')
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (user.signatureUrl) deleteStoredFile(user.signatureUrl)

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { signatureUrl: publicUrlFor(req.file.filename) },
    })

    res.status(201).json({ user: toUserDTO(updated) })
  }),
)

authRouter.delete(
  '/me/signature',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (user.signatureUrl) deleteStoredFile(user.signatureUrl)

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { signatureUrl: null },
    })

    res.json({ user: toUserDTO(updated) })
  }),
)

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      throw new HttpError(400, 'Senha atual incorreta')
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    res.status(204).send()
  }),
)
