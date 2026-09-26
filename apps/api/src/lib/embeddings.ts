/**
 * Vetores de significado (embeddings) do Gemini para a busca da Biblioteca.
 * Falha aqui nunca derruba quem chamou: devolve `null` e a busca segue só
 * por palavras.
 */
import { GoogleGenAI } from '@google/genai'
import { env } from './env.js'

// Teto curto de propósito: a busca da Biblioteca espera por isto a cada
// tecla digitada (com debounce). Melhor cair para a busca por palavras do
// que deixar a tela parada.
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 8_000 } })

export const EMBEDDING_MODEL = env.GEMINI_EMBEDDING_MODEL
// 768 em vez dos 3072 padrão: a qualidade de busca praticamente não muda e o
// vetor ocupa um quarto no banco e na comparação em memória.
const DIMENSIONS = 768
// Limite do Gemini de textos por chamada de embedding.
const MAX_BATCH = 100

const queryCache = new Map<string, number[]>()
const QUERY_CACHE_SIZE = 300

/**
 * Um vetor por texto, na mesma ordem. `document` é o que fica guardado;
 * `query` é o que se pesquisa — o Gemini otimiza cada lado para o outro.
 */
export async function embedTexts(texts: string[], kind: 'document' | 'query'): Promise<number[][] | null> {
  if (texts.length === 0) return []
  try {
    const vectors: number[][] = []
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts.slice(i, i + MAX_BATCH),
        config: {
          taskType: kind === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
          outputDimensionality: DIMENSIONS,
        },
      })
      const batch = response.embeddings?.map((e) => e.values ?? []) ?? []
      if (batch.length !== Math.min(MAX_BATCH, texts.length - i) || batch.some((v) => v.length === 0)) {
        throw new Error(`resposta incompleta (${batch.length} vetores)`)
      }
      vectors.push(...batch)
    }
    return vectors
  } catch (err) {
    console.warn(`[biblioteca] embedding com ${EMBEDDING_MODEL} falhou, seguindo só com palavras:`, err)
    return null
  }
}

/** Vetor de uma busca, lembrando as últimas — quem pesquisa costuma repetir e refinar. */
export async function embedQuery(query: string): Promise<number[] | null> {
  const key = query.trim().toLowerCase()
  const cached = queryCache.get(key)
  if (cached) return cached
  const vectors = await embedTexts([query], 'query')
  const vector = vectors?.[0]
  if (!vector) return null
  if (queryCache.size >= QUERY_CACHE_SIZE) queryCache.delete(queryCache.keys().next().value!)
  queryCache.set(key, vector)
  return vector
}
