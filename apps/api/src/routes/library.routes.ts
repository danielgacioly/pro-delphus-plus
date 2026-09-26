import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/errorHandler.js'
import { toLibraryEntryDTO } from '../lib/dto.js'
import { EMBEDDING_MODEL, embedQuery, embedTexts } from '../lib/embeddings.js'
import { rankLibraryEntries } from '../domain/librarySearch.js'
import type { Prisma } from '../../generated/prisma/client.js'

export const libraryRouter = Router()

libraryRouter.use(requireAuth)

export const libraryEntrySchema = z
  .object({
    question: z.string().trim().min(1, 'Escreva a pergunta'),
    answer: z.string().trim().min(1, 'Escreva a resposta'),
    productIds: z.array(z.string().min(1)).default([]),
    clientIds: z.array(z.string().min(1)).default([]),
  })
  .refine((d) => d.productIds.length + d.clientIds.length > 0, {
    message: 'Escolha pelo menos um tópico (produto ou cliente)',
    path: ['productIds'],
  })

export type LibraryEntryInput = z.infer<typeof libraryEntrySchema>

const entryInclude = {
  products: { select: { id: true, name: true, sku: true }, orderBy: { name: 'asc' } },
  clients: { select: { id: true, name: true, institution: true }, orderBy: { name: 'asc' } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} satisfies Prisma.LibraryEntryInclude

type EntryWithTopics = Prisma.LibraryEntryGetPayload<{ include: typeof entryInclude }>

// O nome do tópico entra no texto comparado: "o Mastotrainer faz X?" precisa
// casar com a resposta cadastrada no Mastotrainer mesmo que a pergunta
// gravada não repita o nome do produto.
function searchableText(entry: {
  question: string
  answer: string
  products: { name: string }[]
  clients: { name: string }[]
}) {
  const topics = [...entry.products, ...entry.clients].map((t) => t.name).join(', ')
  return `Pergunta: ${entry.question}\nResposta: ${entry.answer}\nTópicos: ${topics}`
}

async function resolveTopics(data: LibraryEntryInput) {
  const productIds = [...new Set(data.productIds)]
  const clientIds = [...new Set(data.clientIds)]
  const [products, clients] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }),
  ])
  if (products.length !== productIds.length || clients.length !== clientIds.length) {
    throw new HttpError(400, 'Algum tópico escolhido não existe mais. Recarregue a página e escolha de novo.')
  }
  return { products, clients }
}

async function embeddingFor(entry: Parameters<typeof searchableText>[0]) {
  const vectors = await embedTexts([searchableText(entry)], 'document')
  return vectors?.[0] ? { embedding: vectors[0], embeddingModel: EMBEDDING_MODEL } : { embedding: [], embeddingModel: null }
}

export async function createLibraryEntryRecord(input: LibraryEntryInput, userId: string) {
  const data = libraryEntrySchema.parse(input)
  const topics = await resolveTopics(data)
  return prisma.libraryEntry.create({
    data: {
      question: data.question,
      answer: data.answer,
      ...(await embeddingFor({ ...data, ...topics })),
      products: { connect: topics.products.map((p) => ({ id: p.id })) },
      clients: { connect: topics.clients.map((c) => ({ id: c.id })) },
      createdById: userId,
      updatedById: userId,
    },
    include: entryInclude,
  })
}

export async function updateLibraryEntryRecord(id: string, input: LibraryEntryInput, userId: string) {
  const existing = await prisma.libraryEntry.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new HttpError(404, 'Pergunta não encontrada na Biblioteca')
  const data = libraryEntrySchema.parse(input)
  const topics = await resolveTopics(data)
  return prisma.libraryEntry.update({
    where: { id },
    data: {
      question: data.question,
      answer: data.answer,
      ...(await embeddingFor({ ...data, ...topics })),
      products: { set: topics.products.map((p) => ({ id: p.id })) },
      clients: { set: topics.clients.map((c) => ({ id: c.id })) },
      updatedById: userId,
    },
    include: entryInclude,
  })
}

function needsEmbedding(entry: EntryWithTopics) {
  return entry.embedding.length === 0 || entry.embeddingModel !== EMBEDDING_MODEL
}

// Entrada salva enquanto o Gemini estava fora (ou antes de trocar o modelo)
// fica sem vetor comparável. Em vez de um job à parte, a própria busca
// completa o que falta — a biblioteca é pequena e isso acontece uma vez só.
async function backfillEmbeddings(entries: EntryWithTopics[]) {
  const missing = entries.filter(needsEmbedding).slice(0, 100)
  if (missing.length === 0) return
  const vectors = await embedTexts(missing.map(searchableText), 'document')
  if (!vectors) return
  await Promise.all(
    missing.map((entry, i) => {
      entry.embedding = vectors[i]!
      entry.embeddingModel = EMBEDDING_MODEL
      return prisma.libraryEntry.update({
        where: { id: entry.id },
        data: { embedding: entry.embedding, embeddingModel: EMBEDDING_MODEL },
        select: { id: true },
      })
    }),
  )
}

/**
 * Busca da Biblioteca, usada pela página e pelo NEO. Sem `query`, lista tudo
 * (do mais recente ao mais antigo); com `query`, só o que é do mesmo assunto,
 * do mais parecido ao menos. `semantic` diz se a comparação por significado
 * funcionou ou se caiu para palavras.
 */
export async function searchLibraryEntries(params: {
  query?: string
  productId?: string
  clientId?: string
  limit?: number
}) {
  const entries = await prisma.libraryEntry.findMany({
    where: {
      ...(params.productId && { products: { some: { id: params.productId } } }),
      ...(params.clientId && { clients: { some: { id: params.clientId } } }),
    },
    include: entryInclude,
    orderBy: { updatedAt: 'desc' },
  })

  const query = params.query?.trim()
  if (!query) return { entries: entries.map((e) => toLibraryEntryDTO(e)), semantic: false }

  await backfillEmbeddings(entries)
  const queryEmbedding = await embedQuery(query)
  const ranked = rankLibraryEntries(
    query,
    queryEmbedding,
    entries.map((e) => ({ id: e.id, text: searchableText(e), embedding: needsEmbedding(e) ? null : e.embedding })),
    { limit: params.limit },
  )
  const byId = new Map(entries.map((e) => [e.id, e]))
  return {
    entries: ranked.map((r) => toLibraryEntryDTO(byId.get(r.id)!, r.match)),
    semantic: queryEmbedding !== null,
  }
}

const searchQuerySchema = z.object({
  q: z.string().max(500).optional(),
  productId: z.string().optional(),
  clientId: z.string().optional(),
})

libraryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, productId, clientId } = searchQuerySchema.parse(req.query)
    res.json(await searchLibraryEntries({ query: q, productId, clientId }))
  }),
)

libraryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const entry = await createLibraryEntryRecord(req.body, req.user!.id)
    res.status(201).json({ entry: toLibraryEntryDTO(entry) })
  }),
)

libraryRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await updateLibraryEntryRecord(req.params.id, req.body, req.user!.id)
    res.json({ entry: toLibraryEntryDTO(entry) })
  }),
)

libraryRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.libraryEntry.deleteMany({ where: { id: req.params.id } })
    if (count === 0) throw new HttpError(404, 'Pergunta não encontrada na Biblioteca')
    res.status(204).send()
  }),
)
