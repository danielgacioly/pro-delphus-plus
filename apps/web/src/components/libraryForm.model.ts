/**
 * Formato do formulário da Biblioteca e as conversões entre ele, o DTO e as
 * opções de tópico. Fora do componente pelo mesmo motivo de clientForm.model.ts
 * (fast refresh do Vite).
 */
import type { ClientDTO, LibraryEntryDTO, LibraryEntryInput, LibraryTopicDTO, ProductDTO } from '@prodelphusplus/shared'
import type { ComboboxOption } from './ui'

export interface LibraryFormValues {
  question: string
  answer: string
  topics: LibraryTopicDTO[]
}

export const emptyLibraryForm: LibraryFormValues = { question: '', answer: '', topics: [] }

export function libraryFormFromEntry(entry: LibraryEntryDTO): LibraryFormValues {
  return { question: entry.question, answer: entry.answer, topics: entry.topics }
}

export function toLibraryEntryInput(values: LibraryFormValues): LibraryEntryInput {
  return {
    question: values.question.trim(),
    answer: values.answer.trim(),
    productIds: values.topics.filter((t) => t.type === 'product').map((t) => t.id),
    clientIds: values.topics.filter((t) => t.type === 'client').map((t) => t.id),
  }
}

/** Chave única de um tópico — produto e cliente podem, em tese, ter o mesmo id. */
export function topicKey(topic: Pick<LibraryTopicDTO, 'type' | 'id'>) {
  return `${topic.type}:${topic.id}`
}

export function topicsFromCatalog(products: ProductDTO[], clients: ClientDTO[]): LibraryTopicDTO[] {
  return [
    ...products.map((p) => ({ type: 'product' as const, id: p.id, name: p.name, detail: p.sku })),
    ...clients.map((c) => ({ type: 'client' as const, id: c.id, name: c.name, detail: c.institution })),
  ]
}

export function topicOption(topic: LibraryTopicDTO): ComboboxOption<string> {
  const kind = topic.type === 'product' ? 'Produto' : 'Cliente'
  return { value: topicKey(topic), label: topic.name, description: topic.detail ? `${kind} · ${topic.detail}` : kind }
}
