/**
 * Ranqueamento da busca da Biblioteca. A pergunta de um cliente quase nunca
 * chega com as mesmas palavras de quando foi cadastrada ("simula
 * sangramento?" x "tem hemorragia?"), então o critério principal é o
 * significado (embedding do Gemini); a coincidência de palavras entra como
 * reforço e como plano B quando o Gemini não respondeu.
 */
import { normalize, similarity } from '../lib/fuzzyMatch.js'

export interface RankableEntry {
  id: string
  /** Pergunta, resposta e nomes dos tópicos, já concatenados. */
  text: string
  /** `null` quando ainda não há vetor comparável com o da busca. */
  embedding: number[] | null
}

export type LibraryMatch = 'strong' | 'related'

export interface RankedEntry {
  id: string
  score: number
  match: LibraryMatch
}

// Palavras que aparecem em qualquer pergunta e não dizem nada do assunto —
// sem tirá-las, "o simulador tem..." casaria com metade da biblioteca.
const STOPWORDS = new Set(
  (
    'a o e as os um uma uns umas de do da dos das em no na nos nas por pelo pela para pra com sem ' +
    'que se ao aos à às é ser são foi tem têm ter possui possuem há isso esse essa este esta ele ela ' +
    'eles elas eu voce você vocês voces seu sua seus suas meu minha qual quais como quando onde ' +
    'mais menos muito pode podem posso consegue fazer faz ou nao não sim já também tambem então ' +
    'simulador simuladores modelo produto the and is does do can it of to with for'
  )
    .split(' ')
    .map(normalize),
)

/** Palavras de conteúdo, sem acento, caixa ou plural simples. */
export function contentTokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
}

function tokensMatch(a: string, b: string) {
  if (a === b) return true
  // Mesma raiz: "sutura"/"suturar", "incisão"/"incisões" (sem acento).
  const root = Math.min(a.length, b.length, 6)
  if (root >= 5 && a.slice(0, root) === b.slice(0, root)) return true
  // Erro de digitação numa palavra longa.
  return a.length >= 6 && b.length >= 6 && similarity(a, b) >= 0.84
}

/** Fração (0–1) das palavras de conteúdo da busca que aparecem no texto. */
export function lexicalScore(query: string, text: string): number {
  const queryTokens = [...new Set(contentTokens(query))]
  if (queryTokens.length === 0) return 0
  const textTokens = [...new Set(contentTokens(text))]
  const hits = queryTokens.filter((q) => textTokens.some((t) => tokensMatch(q, t))).length
  return hits / queryTokens.length
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  if (normA === 0 || normB === 0) return 0
  return dot / Math.sqrt(normA * normB)
}

// Os embeddings do Gemini raramente dão cosseno abaixo de ~0,5 entre dois
// textos em português, mesmo sem relação nenhuma — o que distingue "mesmo
// assunto" fica na faixa de cima. Estes limites reescalam essa faixa para
// 0–1. São empíricos: se a busca trouxer coisa demais ou de menos, é aqui
// que se ajusta.
const COSINE_FLOOR = 0.55
const COSINE_CEILING = 0.85
const SEMANTIC_WEIGHT = 0.8
/** Abaixo disso não entra no resultado — melhor "não achei" do que ruído. */
export const RELATED_THRESHOLD = 0.3
export const STRONG_THRESHOLD = 0.65

function semanticScore(queryEmbedding: number[], entryEmbedding: number[]) {
  const cos = cosineSimilarity(queryEmbedding, entryEmbedding)
  return Math.min(1, Math.max(0, (cos - COSINE_FLOOR) / (COSINE_CEILING - COSINE_FLOOR)))
}

/**
 * As entradas que respondem `query`, da mais parecida para a menos. Entrada
 * sem vetor (ou busca sem vetor) é comparada só pelas palavras.
 */
export function rankLibraryEntries(
  query: string,
  queryEmbedding: number[] | null,
  entries: RankableEntry[],
  options?: { limit?: number },
): RankedEntry[] {
  return entries
    .map((entry) => {
      const lexical = lexicalScore(query, entry.text)
      const score =
        queryEmbedding && entry.embedding && entry.embedding.length === queryEmbedding.length
          ? SEMANTIC_WEIGHT * semanticScore(queryEmbedding, entry.embedding) + (1 - SEMANTIC_WEIGHT) * lexical
          : lexical
      return { id: entry.id, score }
    })
    .filter((r) => r.score >= RELATED_THRESHOLD)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, options?.limit ?? 20)
    .map((r) => ({ ...r, match: r.score >= STRONG_THRESHOLD ? 'strong' : 'related' }))
}
