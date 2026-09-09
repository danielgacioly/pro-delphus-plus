// Câmbio diário via AwesomeAPI (grátis, sem chave), usado como ponto de
// partida pro documento de exportação — sempre editável antes de salvar.
// A API aceita qualquer par tipo "USD-BRL"/"EUR-BRL" no mesmo endpoint.
const cache = new Map<string, { rate: number; fetchedAt: number }>()
const CACHE_MS = 5 * 60 * 1000

async function fetchPairRate(pair: string): Promise<number> {
  const cached = cache.get(pair)
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.rate

  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Falha ao buscar câmbio: ${res.status}`)
  const data = (await res.json()) as Record<string, { bid?: string } | undefined>
  const rate = Number(data[pair.replace('-', '')]?.bid)
  if (!rate || Number.isNaN(rate)) throw new Error('Câmbio inválido retornado pela API')

  cache.set(pair, { rate, fetchedAt: Date.now() })
  return rate
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
