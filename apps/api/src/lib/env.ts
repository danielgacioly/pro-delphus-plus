import 'dotenv/config'
import { z } from 'zod'

const isProd = process.env.NODE_ENV === 'production'

/**
 * Segredo fraco em produção é falha silenciosa: o sistema sobe, funciona, e
 * qualquer um que adivinhe a chave assina um token de admin. Por isso a
 * validação é mais dura quando `NODE_ENV=production` — em desenvolvimento
 * continua aceitando qualquer coisa para não travar o dia a dia.
 */
const secret = (name: string) =>
  z
    .string()
    .min(1, `${name} é obrigatório`)
    .superRefine((value, ctx) => {
      if (!isProd) return
      if (value.length < 32) {
        ctx.addIssue({
          code: 'custom',
          message: `${name} precisa de pelo menos 32 caracteres em produção. Gere com: openssl rand -base64 48`,
        })
      }
      if (/troque|change|secret|example|senha|password/i.test(value)) {
        ctx.addIssue({ code: 'custom', message: `${name} ainda está com um valor de exemplo. Troque antes de subir.` })
      }
    })

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().min(1),

  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  UPLOADS_DIR: z.string().default('./uploads'),

  /** Quantos proxies à frente são confiáveis. 1 = o nginx do compose. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(isProd ? 1 : 0),

  /**
   * Marca o cookie de sessão com a flag `Secure`, que o restringe a conexões
   * HTTPS. Precisa ser desligado quando o sistema é servido por HTTP puro:
   * o navegador descarta cookie `Secure` recebido por HTTP (exceto localhost),
   * e o login deixa de persistir entre recarregamentos.
   *
   * `z.coerce.boolean()` não serve aqui — ele converte a string "false" em
   * true, porque qualquer string não vazia é verdadeira em JavaScript.
   */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),

  ADMIN_SEED_NAME: z.string().default('Administrador'),
  ADMIN_SEED_EMAIL: z.string().email().default('admin@prodelphus.com'),
  // Sem default: o seed é o que cria a primeira conta de admin, e um default
  // conhecido no código é uma porta aberta em qualquer instalação nova.
  ADMIN_SEED_PASSWORD: z.string().min(10, 'ADMIN_SEED_PASSWORD precisa de pelo menos 10 caracteres').optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  · ${i.path.join('.') || '(env)'}: ${i.message}`)
  console.error(`\nConfiguração inválida em .env:\n${lines.join('\n')}\n`)
  process.exit(1)
}

export const env = parsed.data
export const IS_PRODUCTION = env.NODE_ENV === 'production'

/**
 * Fonte única da verdade sobre "estamos servindo por HTTPS?". Governa tanto a
 * flag `Secure` do cookie quanto o HSTS — os dois só fazem sentido juntos.
 */
export const COOKIE_SECURE = env.COOKIE_SECURE ?? IS_PRODUCTION

if (IS_PRODUCTION && !COOKIE_SECURE) {
  console.warn(
    '\n⚠️  COOKIE_SECURE=false — o sistema está servindo por HTTP puro.\n' +
      '   Senha e sessão trafegam legíveis na rede. Escolha consciente para\n' +
      '   rede interna; não use assim em rede aberta.\n',
  )
}
