import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  status: number
  // Campos extra pro corpo da resposta — usado quando o frontend precisa de
  // mais do que uma mensagem pra decidir o que fazer (ex.: confirmar e
  // reenviar a mesma ação com um flag, em vez de só mostrar um erro).
  details?: Record<string, unknown>
  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.details = details
  }
}

/**
 * Erros de bibliotecas (express.json, multer) já chegam com o status certo em
 * `status`/`statusCode` — sem ler esse campo, um corpo grande demais ou um
 * arquivo recusado viravam "500 Erro interno", escondendo do usuário o que ele
 * precisa corrigir. Só status 4xx são aproveitados: 5xx alheio continua virando
 * a mensagem genérica, porque aí o problema é nosso e não do request.
 */
function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  const raw = (err as { status?: unknown; statusCode?: unknown })
  const status = typeof raw.status === 'number' ? raw.status : typeof raw.statusCode === 'number' ? raw.statusCode : null
  return status !== null && status >= 400 && status < 500 ? status : null
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.details })
  }

  // Arquivo maior que o teto do multer chega como MulterError sem status.
  if (err instanceof Error && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo muito grande. O limite é 25 MB.' })
  }

  const status = clientErrorStatus(err)
  if (status !== null && err instanceof Error) {
    const message =
      status === 413 ? 'Conteúdo enviado é grande demais.' : err.message || 'Requisição inválida'
    return res.status(status).json({ error: message })
  }

  console.error(err)
  return res.status(500).json({ error: 'Erro interno do servidor' })
}

export function asyncHandler<P extends Record<string, string> = Record<string, string>>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}
