import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { fetchPairQuote } from '../lib/exchangeRate.js'

export const exchangeRouter = Router()

exchangeRouter.use(requireAuth)

const PAIRS = ['USD-BRL', 'EUR-BRL'] as const

/**
 * Cotações do dia para o painel do Início. A fonte é a mesma que já preenche o
 * câmbio do documento de exportação (AwesomeAPI, cache de 5 min no processo).
 * Um par que falhar sai da lista em vez de derrubar a resposta inteira: a tela
 * inicial não pode quebrar porque uma API pública ficou fora do ar.
 */
exchangeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // ?refresh=1 (botão de atualizar no Início) pula o cache de 5 min.
    const force = req.query.refresh === '1'
    const settled = await Promise.allSettled(PAIRS.map((pair) => fetchPairQuote(pair, { force })))
    const rates = settled.flatMap((result, i) =>
      result.status === 'fulfilled' ? [{ pair: PAIRS[i], ...result.value }] : [],
    )
    res.json({ rates })
  }),
)
