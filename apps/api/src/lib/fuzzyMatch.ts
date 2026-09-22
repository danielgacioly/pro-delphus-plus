/**
 * Sugestão de "você quis dizer?" pro NEO — quando a busca exata de cliente ou
 * produto não acha nada, isso rankeia os cadastros existentes por
 * semelhança com o texto digitado, pra sugerir em vez de simplesmente dizer
 * "não encontrado". Erro de digitação (ex. "MediGlobal" por "Mad Global")
 * não deve virar um cliente/produto inexistente.
 */

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Também tira espaço: nome de empresa varia muito em como é espaçado
// ("Mad Global" vs "MadGlobal"), e isso não deveria pesar na semelhança.
const compact = (s: string) => normalize(s).replace(/\s+/g, '')

/** Distância de edição (Levenshtein) — quantas trocas/inserções/remoções separam `a` de `b`. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1]
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      currentRow.push(Math.min(currentRow[j]! + 1, previousRow[j + 1]! + 1, previousRow[j]! + cost))
    }
    previousRow = currentRow
  }
  return previousRow[b.length]!
}

/** 1 = idêntico (ignorando acento/caixa/espaço), 0 = nada em comum. */
export function similarity(a: string, b: string): number {
  const x = compact(a)
  const y = compact(b)
  const maxLen = Math.max(x.length, y.length, 1)
  return 1 - levenshtein(x, y) / maxLen
}

/**
 * Os `limit` itens de `items` mais parecidos com `query`, acima do `threshold`
 * de semelhança — nem toda busca sem resultado exato merece sugestão (um
 * texto completamente diferente não deveria virar um "você quis dizer?").
 */
export function bestMatches<T>(
  query: string,
  items: T[],
  nameOf: (item: T) => string,
  options?: { limit?: number; threshold?: number },
): T[] {
  const limit = options?.limit ?? 3
  const threshold = options?.threshold ?? 0.6
  return items
    .map((item) => ({ item, score: similarity(query, nameOf(item)) }))
    .filter((x) => x.score >= threshold)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item)
}
