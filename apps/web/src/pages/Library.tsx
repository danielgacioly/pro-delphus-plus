import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClientDTO, LibraryEntryDTO, LibraryEntryInput, ProductDTO } from '@prodelphusplus/shared'
import { api, getErrorMessage } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal } from '../components/Modal'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { LibraryEntryForm } from '../components/LibraryEntryForm'
import {
  emptyLibraryForm,
  libraryFormFromEntry,
  toLibraryEntryInput,
  topicKey,
  topicOption,
  topicsFromCatalog,
  type LibraryFormValues,
} from '../components/libraryForm.model'
import { Alert, Badge, Button, Card, Combobox, EmptyState, Page, SearchField, Skeleton, Spinner, Toolbar } from '../components/ui'
import { IconBook, IconBox, IconContacts, IconPencil, IconPlus, IconTrash } from '../components/icons'

interface LibrarySearchResponse {
  entries: LibraryEntryDTO[]
  semantic: boolean
}

async function fetchLibrary(q: string, topic: string | null) {
  const [type, id] = topic?.split(':') ?? []
  const { data } = await api.get<LibrarySearchResponse>('/library', {
    params: { q: q || undefined, productId: type === 'product' ? id : undefined, clientId: type === 'client' ? id : undefined },
  })
  return data
}

async function fetchTopics() {
  const [products, clients] = await Promise.all([
    api.get<{ products: ProductDTO[] }>('/products'),
    api.get<{ clients: ClientDTO[] }>('/clients'),
  ])
  return topicsFromCatalog(products.data.products, clients.data.clients.filter((c) => c.active))
}

// A busca por significado chama o Gemini a cada consulta: esperar a pessoa
// parar de digitar evita uma chamada por letra.
const SEARCH_DEBOUNCE_MS = 400
// Resposta longa vira "Ver mais" — a lista é para bater o olho em várias
// perguntas, não para ler uma só.
const LONG_ANSWER = 320

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LibraryEntryDTO
  onEdit: (entry: LibraryEntryDTO) => void
  onDelete: (entry: LibraryEntryDTO) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = entry.answer.length > LONG_ANSWER
  const author = entry.updatedByName ?? entry.createdByName

  return (
    <Card className="px-5 pt-4 pb-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {entry.match && (
            <Badge tone={entry.match === 'strong' ? 'success' : 'neutral'} dot className="mb-2">
              {entry.match === 'strong' ? 'Quase a mesma pergunta' : 'Mesmo assunto'}
            </Badge>
          )}
          <p className="text-[15px] font-semibold tracking-[-0.014em] text-ink-900">{entry.question}</p>
          <p className={`mt-1.5 text-[14px] leading-relaxed whitespace-pre-line text-ink-800 ${long && !expanded ? 'line-clamp-4' : ''}`}>
            {entry.answer}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              {expanded ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
        <div className="-mr-1 flex shrink-0 gap-0.5">
          <button
            type="button"
            title="Editar"
            aria-label="Editar pergunta"
            onClick={() => onEdit(entry)}
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-ink-900"
          >
            <IconPencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Excluir"
            aria-label="Excluir pergunta"
            onClick={() => onDelete(entry)}
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-danger-600"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-black/[0.06] pt-3">
        <div className="flex flex-wrap gap-1.5">
          {entry.topics.length === 0 ? (
            <span className="text-[12px] text-neutral-500">Tópico removido do cadastro</span>
          ) : (
            entry.topics.map((topic) => {
              const Icon = topic.type === 'product' ? IconBox : IconContacts
              const chip = (
                <span className="inline-flex h-[22px] items-center gap-1 rounded-md bg-black/[0.05] px-1.5 text-[12px] font-medium text-neutral-700">
                  <Icon className="h-3 w-3" />
                  {topic.name}
                </span>
              )
              return topic.type === 'client' ? (
                <Link key={topicKey(topic)} to={`/clientes/${topic.id}`} className="transition-opacity hover:opacity-75">
                  {chip}
                </Link>
              ) : (
                <span key={topicKey(topic)} title={topic.detail ?? undefined}>
                  {chip}
                </span>
              )
            })
          )}
        </div>
        <p className="text-[12px] text-neutral-500">
          {author ? `${author} · ` : ''}
          {new Date(entry.updatedAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </Card>
  )
}

type Editing = { mode: 'create'; initial: LibraryFormValues } | { mode: 'edit'; entry: LibraryEntryDTO }

export function Library() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [topicFilterText, setTopicFilterText] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<LibraryEntryDTO | null>(null)

  const query = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS)
  const searching = query.length > 0

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['library', query, topicFilter],
    queryFn: () => fetchLibrary(query, topicFilter),
    placeholderData: keepPreviousData,
  })
  const { data: topics = [] } = useQuery({ queryKey: ['library-topics'], queryFn: fetchTopics })
  const topicOptions = useMemo(() => topics.map(topicOption), [topics])
  const selectedTopic = topics.find((t) => topicKey(t) === topicFilter)

  const saveMutation = useMutation({
    mutationFn: async ({ input, id }: { input: LibraryEntryInput; id?: string }) => {
      if (id) await api.put(`/library/${id}`, input)
      else await api.post('/library', input)
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      setEditing(null)
      setFormError(null)
      toast.success(id ? 'Pergunta atualizada.' : 'Pergunta cadastrada na Biblioteca.')
    },
    onError: (err: unknown) => setFormError(getErrorMessage(err, 'Não foi possível salvar a pergunta.')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/library/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      setDeleting(null)
      toast.success('Pergunta excluída.')
    },
  })

  // Quem não achou a resposta volta depois para cadastrá-la — já com a
  // pergunta que pesquisou e o tópico do filtro, para não digitar de novo.
  function startCreate(prefill = false) {
    setFormError(null)
    setEditing({
      mode: 'create',
      initial: prefill
        ? { ...emptyLibraryForm, question: search.trim(), topics: selectedTopic ? [selectedTopic] : [] }
        : emptyLibraryForm,
    })
  }

  const entries = data?.entries ?? []

  return (
    <Page
      title="Biblioteca"
      description="O que os clientes já perguntaram sobre os simuladores, com a resposta confirmada pela empresa. Pesquise com as palavras do cliente: a busca procura pelo sentido, não pelas palavras exatas."
    >
      <Toolbar className="mb-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Ex.: dá para treinar sutura intradérmica nesse modelo?"
          className="min-w-0 w-full sm:max-w-lg sm:flex-1"
        />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Combobox
            options={topicOptions}
            value={topicFilter ?? undefined}
            inputValue={topicFilterText}
            onInputValueChange={setTopicFilterText}
            onSelect={(value) => {
              setTopicFilter(value)
              setTopicFilterText('')
            }}
            placeholder="Todos os tópicos"
            emptyMessage="Nenhum produto ou cliente com esse nome."
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          {topicFilter && (
            <Button variant="ghost" size="sm" onClick={() => setTopicFilter(null)}>
              Limpar
            </Button>
          )}
        </div>
        <Button variant="primary" size="md" onClick={() => startCreate()} className="sm:ml-auto">
          <IconPlus className="h-4 w-4" />
          Nova pergunta
        </Button>
      </Toolbar>

      <div className="mb-5 flex h-5 items-center gap-2 text-[12px] text-neutral-600">
        {isFetching && !isLoading && <Spinner className="h-3.5 w-3.5" />}
        {data &&
          (searching
            ? data.semantic
              ? `${entries.length} ${entries.length === 1 ? 'resposta' : 'respostas'} do mesmo assunto, da mais parecida para a menos`
              : 'Busca por sentido indisponível agora — mostrando o que tem as mesmas palavras'
            : `${entries.length} ${entries.length === 1 ? 'pergunta' : 'perguntas'}${selectedTopic ? ` sobre ${selectedTopic.name}` : ' na Biblioteca'}`)}
      </div>

      {isError ? (
        <Alert tone="error">Não foi possível carregar a Biblioteca.</Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
            </Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          {searching ? (
            <EmptyState
              icon={IconBook}
              title="Nada parecido na Biblioteca"
              description="Ninguém cadastrou essa resposta ainda. Quando a empresa confirmar, cadastre aqui para a próxima vez."
              action={
                <Button variant="primary" onClick={() => startCreate(true)}>
                  <IconPlus className="h-4 w-4" />
                  Cadastrar esta pergunta
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={IconBook}
              title={topicFilter ? 'Nenhuma pergunta sobre esse tópico' : 'A Biblioteca está vazia'}
              description="Cada pergunta respondida vira consulta rápida para a equipe e para o NEO."
              action={
                <Button variant="primary" onClick={() => startCreate(Boolean(topicFilter))}>
                  <IconPlus className="h-4 w-4" />
                  Nova pergunta
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={entry.id} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} className="animate-fade-in-up">
              <EntryCard
                entry={entry}
                onEdit={(e) => {
                  setFormError(null)
                  setEditing({ mode: 'edit', entry: e })
                }}
                onDelete={setDeleting}
              />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-scale-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-title text-ink-900">{editing.mode === 'edit' ? 'Editar pergunta' : 'Nova pergunta'}</h2>
            <p className="mt-1 text-[13px] text-neutral-600">
              Fica disponível na busca da Biblioteca e para o NEO responder quando perguntarem.
            </p>
            <div className="mt-5">
              <LibraryEntryForm
                initialValues={editing.mode === 'edit' ? libraryFormFromEntry(editing.entry) : editing.initial}
                topics={topics}
                isPending={saveMutation.isPending}
                error={formError}
                submitLabel={editing.mode === 'edit' ? 'Salvar' : 'Cadastrar'}
                onSubmit={(values) =>
                  saveMutation.mutate({
                    input: toLibraryEntryInput(values),
                    id: editing.mode === 'edit' ? editing.entry.id : undefined,
                  })
                }
                onCancel={() => setEditing(null)}
              />
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDeleteModal
          title="Excluir pergunta"
          description={`"${deleting.question}" sai da Biblioteca e o NEO deixa de usá-la.`}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  )
}
