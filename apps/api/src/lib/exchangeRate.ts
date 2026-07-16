// Daily USD/BRL rate from AwesomeAPI (free, no key required), used as a starting
// point for the export document — always editable by the admin before saving.
const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'

let cached: { rate: number; fetchedAt: number } | null = null
const CACHE_MS = 5 * 60 * 1000

export async function fetchUsdBrlRate(): Promise<number> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return cached.rate
  }
  const res = await fetch(AWESOME_API_URL, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Falha ao buscar câmbio: ${res.status}`)
  const data = (await res.json()) as { USDBRL?: { bid?: string } }
  const rate = Number(data.USDBRL?.bid)
  if (!rate || Number.isNaN(rate)) throw new Error('Câmbio inválido retornado pela API')
  cached = { rate, fetchedAt: Date.now() }
  return rate
}
