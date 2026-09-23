// Câmbio diário via AwesomeAPI (grátis, sem chave), usado como ponto de
// partida pro documento de exportação — sempre editável antes de salvar.
// A API aceita qualquer par tipo "USD-BRL"/"EUR-BRL" no mesmo endpoint.
export interface PairQuote {
  /** Cotação de compra (bid), em reais. */
  rate: number
  /** Variação percentual do dia, como a própria API devolve (ex.: -0.42). */
  pctChange: number
  /** Momento da cotação, ISO. */
  updatedAt: string
}

const cache = new Map<string, { quote: PairQuote; fetchedAt: number }>()
const CACHE_MS = 5 * 60 * 1000

/** `force` ignora o cache de 5 min — é o botão de atualizar do Início. */
export async function fetchPairQuote(pair: string, { force = false } = {}): Promise<PairQuote> {
  const cached = cache.get(pair)
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.quote

  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Falha ao buscar câmbio: ${res.status}`)
  const data = (await res.json()) as Record<
    string,
    { bid?: string; pctChange?: string; timestamp?: string } | undefined
  >
  const entry = data[pair.replace('-', '')]
  const rate = Number(entry?.bid)
  if (!rate || Number.isNaN(rate)) throw new Error('Câmbio inválido retornado pela API')

  // timestamp vem em segundos; sem ele, "agora" é a melhor aproximação.
  const seconds = Number(entry?.timestamp)
  const quote: PairQuote = {
    rate,
    pctChange: Number(entry?.pctChange) || 0,
    updatedAt: (Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date()).toISOString(),
  }

  cache.set(pair, { quote, fetchedAt: Date.now() })
  return quote
}

async function fetchPairRate(pair: string): Promise<number> {
  return (await fetchPairQuote(pair)).rate
}

export async function fetchUsdBrlRate(): Promise<number> {
  return fetchPairRate('USD-BRL')
}

export async function fetchEurBrlRate(): Promise<number> {
  return fetchPairRate('EUR-BRL')
}

/** Pedido internacional só usa USD ou EUR (nunca BRL — ver Quote.exportScope). */
export async function fetchExchangeRate(currency: 'USD' | 'EUR'): Promise<number> {
  return currency === 'EUR' ? fetchEurBrlRate() : fetchUsdBrlRate()
}
