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

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos', issues: err.issues })
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.details })
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
