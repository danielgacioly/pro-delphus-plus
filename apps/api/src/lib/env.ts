import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  UPLOADS_DIR: z.string().default('./uploads'),
  ADMIN_SEED_NAME: z.string().default('Administrador'),
  ADMIN_SEED_EMAIL: z.string().email().default('admin@prodelphus.com'),
  ADMIN_SEED_PASSWORD: z.string().min(6).default('troque-esta-senha'),
})

export const env = envSchema.parse(process.env)
