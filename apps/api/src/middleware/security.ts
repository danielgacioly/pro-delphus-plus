import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import helmet from 'helmet'
import type { Request } from 'express'

import { COOKIE_SECURE } from '../lib/env.js'

/**
 * Cabeçalhos de segurança.
 *
 * CSP fica desligada de propósito: quem serve o HTML é o nginx do front, não
 * esta API — aqui só trafegam JSON e os arquivos de /uploads. Uma CSP definida
 * neste processo não protegeria a página e ainda daria falsa sensação de cobertura.
 *
 * `crossOriginResourcePolicy: cross-origin` é obrigatório: as fotos de produto e
 * as assinaturas são carregadas pelo front, que em desenvolvimento vive em outra
 * origem. O padrão do helmet (`same-origin`) bloquearia todas elas.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  // HSTS só quando de fato há HTTPS: anunciar 'só me acesse por HTTPS' num
  // sistema servido por HTTP trancaria o acesso de todo mundo.
  hsts: COOKIE_SECURE ? { maxAge: 31_536_000, includeSubDomains: true } : false,
})

/**
 * Em produção a API roda atrás do nginx, então `req.ip` só é o IP real do
 * cliente porque o app confia no proxy (`trust proxy`). Sem isso o limite
 * valeria para o proxy inteiro e um único usuário derrubaria o login de todos.
 */
function clientKey(req: Request) {
  return ipKeyGenerator(req.ip ?? 'desconhecido')
}

const rateLimitMessage = (message: string) => ({
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: message },
})

/**
 * Login e cadastro: janela curta e teto baixo, contando só as tentativas que
 * falham. Quem acerta a senha não gasta cota, então o limite atrapalha ataque de
 * força bruta sem atrapalhar quem usa o sistema.
 */
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  ...rateLimitMessage('Muitas tentativas de acesso. Tente novamente em alguns minutos.'),
})

/**
 * Teto geral por IP. Alto o bastante para não incomodar o uso normal (uma tela
 * de pedido dispara várias chamadas), baixo o bastante para conter varredura.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  ...rateLimitMessage('Muitas requisições. Aguarde um instante.'),
})
