import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { env } from './lib/env.js'
import { authRouter } from './routes/auth.routes.js'
import { usersRouter } from './routes/users.routes.js'
import { productsRouter } from './routes/products.routes.js'
import { quotesRouter } from './routes/quotes.routes.js'
import { sectorsRouter } from './routes/sectors.routes.js'
import { ordersRouter } from './routes/orders.routes.js'
import { statsRouter } from './routes/stats.routes.js'
import { tasksRouter } from './routes/tasks.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR)))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/products', productsRouter)
app.use('/api/quotes', quotesRouter)
app.use('/api/sectors', sectorsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/stats', statsRouter)
app.use('/api/tasks', tasksRouter)

app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`Pro Delphus+ API rodando em http://localhost:${env.PORT}`)
})
