import 'dotenv/config'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@prodelphusplus/shared'

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
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

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

  /** Piso do número do próximo pedido — o próximo é sempre max(maior existente + 1, este valor), nunca menor. */
  ORDER_NUMBER_START: z.coerce.number().int().min(0).default(0),
  /** Piso do próximo "ID da pasta do cliente" (só pedido internacional) — mesma regra de piso do ORDER_NUMBER_START. */
  CLIENT_FOLDER_ID_START: z.coerce.number().int().min(0).default(1),

  ADMIN_SEED_NAME: z.string().default('Administrador'),
  ADMIN_SEED_EMAIL: z.string().email().default('admin@prodelphus.com'),
  // Sem default: o seed é o que cria a primeira conta de admin, e um default
  // conhecido no código é uma porta aberta em qualquer instalação nova.
  ADMIN_SEED_PASSWORD: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `ADMIN_SEED_PASSWORD precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres`)
    .optional(),

  // Google AI Studio free-tier key — https://aistudio.google.com/apikey.
  // Sem default: sem chave, o NEO não tem como funcionar, e é melhor a API
  // recusar subir do que o endpoint falhar silenciosamente na primeira
  // pergunta.
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY é obrigatório — gere uma chave grátis em https://aistudio.google.com/apikey'),
  // O flash-lite é o mais rápido e o mais barato da família, e faz function
  // calling bem — modelo "maior" não deixa o NEO mais rápido, só mais lento
  // (raciocina mais antes de responder).
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  // Quando o modelo principal esgota as tentativas (pico de demanda do lado
  // do Google, 429/5xx), tenta estes em ordem antes de desistir. O 3.5-flash
  // vem antes do 3.6-flash por ser bem mais rápido: visto ao vivo, o 3.6
  // chegou a abortar aos 45s sem responder. Lista separada por vírgula.
  GEMINI_FALLBACK_MODELS: z
    .string()
    .default('gemini-3.5-flash,gemini-3.6-flash')
    .transform((s) => s.split(',').map((m) => m.trim()).filter(Boolean)),
  // Gera o "vetor de significado" das perguntas da Biblioteca, que é o que
  // deixa a busca achar "simula sangramento?" quando o cadastrado é "tem
  // hemorragia?". Trocar o modelo faz a busca recalcular os vetores antigos.
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),

  // Groq (Whisper) transcreve o ditado por voz do NEO — free tier próprio,
  // sem gastar a cota do Gemini. Gere uma chave grátis em https://console.groq.com.
  // Opcional: sem ela, o botão de microfone continua aparecendo, mas a
  // transcrição falha com um aviso claro em vez de derrubar o resto do NEO.
  GROQ_API_KEY: z.string().min(1).optional(),
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
