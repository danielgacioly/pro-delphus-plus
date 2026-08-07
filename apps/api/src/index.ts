import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { env } from './lib/env.js'
import { verifyRefreshToken } from './lib/jwt.js'
import { authRouter } from './routes/auth.routes.js'
import { usersRouter } from './routes/users.routes.js'
import { productsRouter } from './routes/products.routes.js'
import { quotesRouter } from './routes/quotes.routes.js'
import { clientsRouter } from './routes/clients.routes.js'
import { sectorsRouter } from './routes/sectors.routes.js'
import { ordersRouter } from './routes/orders.routes.js'
import { statsRouter } from './routes/stats.routes.js'
import { tasksRouter } from './routes/tasks.routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter, authLimiter, securityHeaders } from './middleware/security.js'

const app = express()

// Em produção o nginx é quem termina a conexão; sem confiar nele, todo request
// chegaria com o IP do proxy e o rate limit trataria a empresa inteira como um
// cliente só. `1` = confia apenas no primeiro salto, que é o nosso nginx.
app.set('trust proxy', env.TRUST_PROXY)

app.use(securityHeaders)
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
// Teto de corpo: sem isso um POST gigante em qualquer rota JSON derruba o
// processo por memória. Uploads de arquivo passam pelo multer, não por aqui.
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// /uploads guarda documentos comerciais com nomes sequenciais (Order-2800-
// Invoice.pdf, Quote-260807-01.pdf...). Com o sistema exposto na internet,
// servir isso sem sessão seria publicar o histórico de vendas para quem
// souber contar. A checagem usa o cookie de sessão (path '/') porque <img> e
// PDFs abertos em nova aba não têm como mandar header Authorization.
app.use('/uploads', (req, res, next) => {
  try {
    verifyRefreshToken(req.cookies?.pd_refresh_token ?? '')
    next()
  } catch {
    res.status(401).json({ error: 'Faça login para acessar este arquivo' })
  }
})
app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR)))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api', apiLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/products', productsRouter)
app.use('/api/quotes', quotesRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/sectors', sectorsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/stats', statsRouter)
app.use('/api/tasks', tasksRouter)

app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`Pro Delphus+ API rodando em http://localhost:${env.PORT}`)
})
