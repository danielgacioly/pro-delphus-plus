import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreatePersonalTaskInput,
  OrderDTO,
  PersonalBoardColumnDTO,
  PersonalTaskDTO,
  QuoteDTO,
} from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { cn } from '../lib/cn'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { Modal } from '../components/Modal'
import {
  Button,
  EmptyState,
  Field,
  Input,
  Page,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui'
import {
  IconAlert,
  IconBoard,
  IconCheckCircle,
  IconChevronDown,
  IconPlus,
  IconQuote,
  IconTruck,
} from '../components/icons'

async function fetchColumns() {
  const { data } = await api.get<{ columns: PersonalBoardColumnDTO[] }>('/tasks/board-columns')
  return data.columns
}

async function fetchTasks() {
  const { data } = await api.get<{ tasks: PersonalTaskDTO[] }>('/tasks')
  return data.tasks
}

async function fetchClients() {
  const { data } = await api.get<{ clients: string[] }>('/tasks/clients')
  return data.clients
}

async function fetchTags() {
  const { data } = await api.get<{ tags: string[] }>('/tasks/tags')
  return data.tags
}

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

async function fetchOrders() {
  const { data } = await api.get<{ orders: OrderDTO[] }>('/orders')
  return data.orders
}

const emptyDraft = { title: '', clientName: '', notes: '', quoteId: '', orderId: '', columnId: '', dueDate: '' }

const COLLAPSED_STORAGE_KEY = 'mydesk-collapsed-columns'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsed(value: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // storage indisponível — a preferência só vale para esta sessão
  }
}

// Tarefa em um quadro marcado como "concluído" nunca aparece como atrasada,
// não importa a data — já foi feita.
function isOverdue(dueDate: string | null, isDone: boolean) {
  if (!dueDate || isDone) return false
  return new Date(dueDate).getTime() < Date.now()
}

function formatDueDate(dueDate: string) {
  return new Date(dueDate).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// <input type="datetime-local"> troca dados em horário LOCAL, sem timezone —
// convertendo pra/de ISO explicitamente aqui, o instante final nunca depende
// de o navegador e o servidor compartilharem o mesmo fuso horário.
function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIsoFromDatetimeLocal(value: string) {
  return new Date(value).toISOString()
}

/** Duplo clique renomeia o quadro no lugar — sem abrir modal para algo tão pequeno. */
function ColumnTitle({ column }: { column: PersonalBoardColumnDTO }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(column.name)

  const renameColumn = useMutation({
    mutationFn: async (name: string) => api.patch(`/tasks/board-columns/${column.id}`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board-columns'] }),
  })

  function commit() {
    const trimmed = draft.trim()
    setEditing(false)
    if (!trimmed || trimmed === column.name) {
      setDraft(column.name)
      return
    }
    renameColumn.mutate(trimmed)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(column.name)
            setEditing(false)
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="text-eyebrow w-full rounded-md border border-brand-300 bg-white px-1.5 py-0.5 text-ink-900 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
      />
    )
  }

  return (
    <h3
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      title="Clique duas vezes para renomear"
      className="text-eyebrow cursor-text select-none truncate text-neutral-500"
    >
      {column.name}
    </h3>
  )
}

function EditTaskModal({
  task,
  columns,
  myQuotes,
  myOrders,
  clientSuggestions,
  tagSuggestions,
  onClose,
}: {
  task: PersonalTaskDTO
  columns: PersonalBoardColumnDTO[]
  myQuotes: QuoteDTO[]
  myOrders: OrderDTO[]
  clientSuggestions: string[] | undefined
  tagSuggestions: string[] | undefined
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState(task.title)
  const [clientName, setClientName] = useState(task.clientName ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [dueDate, setDueDate] = useState(task.dueDate ? toDatetimeLocalValue(task.dueDate) : '')
  const [columnId, setColumnId] = useState(task.columnId)
  const [quoteId, setQuoteId] = useState(task.quoteId ?? '')
  const [orderId, setOrderId] = useState(task.orderId ?? '')
  const [tags, setTags] = useState<string[]>(task.tags)
  const [tagDraft, setTagDraft] = useState('')

  const updateTask = useMutation({
    mutationFn: async () =>
      api.patch(`/tasks/${task.id}`, {
        title,
        clientName: clientName || null,
        notes: notes || null,
        dueDate: dueDate ? toIsoFromDatetimeLocal(dueDate) : null,
        columnId,
        quoteId: quoteId || null,
        orderId: orderId || null,
        tags,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-clients'] })
      queryClient.invalidateQueries({ queryKey: ['task-tags'] })
      toast.success('Tarefa atualizada.')
      onClose()
    },
  })

  function addTag(raw: string) {
    const typed = raw.trim()
    if (!typed || tags.includes(typed)) {
      setTagDraft('')
      return
    }
    setTags((s) => [...s, typed])
    setTagDraft('')
  }

  return (
    <Modal onClose={onClose} dismissOnBackdrop>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          updateTask.mutate()
        }}
        className="animate-scale-in max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-title text-ink-900">Editar tarefa</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-neutral-500/10 hover:text-ink-900 active:scale-90"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Título" className="sm:col-span-2">
            <Input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Cliente (opcional)">
            <Input list="edit-task-clients" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            <datalist id="edit-task-clients">
              {clientSuggestions?.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label="Quadro">
            <Select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prazo (data e hora, opcional)">
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>

          <Field label="Tags (opcional)">
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-[12px] font-medium text-neutral-700"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags((s) => s.filter((x) => x !== t))}
                      className="text-neutral-400 transition-colors hover:text-brand-600"
                      aria-label={`Remover tag ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              list="edit-task-tags"
              placeholder="Digite e aperte Enter"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag(tagDraft)
                }
              }}
            />
            <datalist id="edit-task-tags">
              {tagSuggestions?.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>

          <Field label="Vincular a orçamento">
            <Select value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
              <option value="">—</option>
              {myQuotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quoteNumber} — {q.clientName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Vincular a pedido">
            <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">—</option>
              {myOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber} — {o.quote.clientName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notas (opcional)" className="sm:col-span-2">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={updateTask.isPending}>
            {updateTask.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function MyDesk() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: columns } = useQuery({ queryKey: ['board-columns'], queryFn: fetchColumns })
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks })
  const { data: clientSuggestions } = useQuery({ queryKey: ['task-clients'], queryFn: fetchClients })
  const { data: tagSuggestions } = useQuery({ queryKey: ['task-tags'], queryFn: fetchTags })
  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })

  const myQuotes = useMemo(() => (quotes ?? []).filter((q) => q.createdBy.id === user?.id), [quotes, user])
  const myOrders = useMemo(() => (orders ?? []).filter((o) => o.createdBy.id === user?.id), [orders, user])

  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [tagDraft, setTagDraft] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deletingColumn, setDeletingColumn] = useState<PersonalBoardColumnDTO | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  const [columnError, setColumnError] = useState<string | null>(null)

  const editingTask = useMemo(() => tasks?.find((t) => t.id === editingTaskId) ?? null, [tasks, editingTaskId])

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })

  const createTask = useMutation({
    mutationFn: async () => {
      const payload: CreatePersonalTaskInput = {
        title: draft.title,
        clientName: draft.clientName || undefined,
        notes: draft.notes || undefined,
        tags: draftTags.length ? draftTags : undefined,
        dueDate: draft.dueDate ? toIsoFromDatetimeLocal(draft.dueDate) : undefined,
        columnId: draft.columnId || undefined,
        quoteId: draft.quoteId || undefined,
        orderId: draft.orderId || undefined,
      }
      await api.post('/tasks', payload)
    },
    onSuccess: () => {
      invalidateTasks()
      queryClient.invalidateQueries({ queryKey: ['task-clients'] })
      queryClient.invalidateQueries({ queryKey: ['task-tags'] })
      setDraft(emptyDraft)
      setDraftTags([])
      setShowForm(false)
      toast.success('Tarefa criada.')
    },
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; columnId: string; position: number }) =>
      api.patch(`/tasks/${id}`, patch),
    onSuccess: invalidateTasks,
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      invalidateTasks()
      toast.success('Tarefa excluída.')
    },
  })

  const createColumn = useMutation({
    mutationFn: async (name: string) => api.post('/tasks/board-columns', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-columns'] })
      setNewColumnName('')
      setAddingColumn(false)
    },
  })

  const reorderColumns = useMutation({
    mutationFn: async (order: { id: string; position: number }[]) => {
      await Promise.all(order.map((o) => api.patch(`/tasks/board-columns/${o.id}`, { position: o.position })))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board-columns'] }),
  })

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/board-columns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-columns'] })
      setColumnError(null)
      setDeletingColumn(null)
      toast.success('Quadro excluído.')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível excluir o quadro.'
      setColumnError(message)
      setDeletingColumn(null)
    },
  })

  const toggleColumnDone = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => api.patch(`/tasks/board-columns/${id}`, { isDone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board-columns'] }),
  })

  const grouped = useMemo(() => {
    const map: Record<string, PersonalTaskDTO[]> = {}
    for (const col of columns ?? []) map[col.id] = []
    for (const t of tasks ?? []) (map[t.columnId] ??= []).push(t)
    return map
  }, [columns, tasks])

  useEffect(() => saveCollapsed(collapsed), [collapsed])

  function toggleCollapsed(columnId: string) {
    setCollapsed((s) => ({ ...s, [columnId]: !s[columnId] }))
  }

  function addDraftTag(raw: string) {
    const typed = raw.trim()
    if (!typed || draftTags.includes(typed)) {
      setTagDraft('')
      return
    }
    setDraftTags((s) => [...s, typed])
    setTagDraft('')
  }

  function handleDrop(columnId: string) {
    if (!draggingId) return
    const task = tasks?.find((t) => t.id === draggingId)
    setDraggingId(null)
    if (!task || task.columnId === columnId) return
    const target = grouped[columnId] ?? []
    const position = target.length ? Math.max(...target.map((t) => t.position)) + 1 : 0
    updateTask.mutate({ id: task.id, columnId, position })
  }

  function handleColumnDrop(targetColumnId: string) {
    if (!draggingColumnId || !columns) return
    const fromIndex = columns.findIndex((c) => c.id === draggingColumnId)
    const toIndex = columns.findIndex((c) => c.id === targetColumnId)
    setDraggingColumnId(null)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    const reordered = [...columns]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const withPositions = reordered.map((c, i) => ({ ...c, position: i }))
    queryClient.setQueryData<PersonalBoardColumnDTO[]>(['board-columns'], withPositions)
    reorderColumns.mutate(withPositions.map((c) => ({ id: c.id, position: c.position })))
  }

  return (
    <Page
      title="Minha Pro Delphus"
      description="Seu espaço pessoal: pendências, lembretes e acesso rápido ao que você já criou."
      actions={
        <>
          <Button size="sm" onClick={() => setAddingColumn((s) => !s)}>
            {addingColumn ? 'Cancelar' : 'Novo quadro'}
          </Button>
          <Button size="sm" variant="primary" onClick={() => setShowForm((s) => !s)}>
            <IconPlus className="h-4 w-4" />
            {showForm ? 'Cancelar' : 'Nova tarefa'}
          </Button>
        </>
      }
    >
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/orcamentos"
          className="group rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <IconQuote className="h-4 w-4" />
            </span>
            <p className="text-eyebrow text-neutral-400">Meus orçamentos</p>
          </div>
          <p className="tabular mt-3 text-[28px] font-bold leading-none text-ink-900">{myQuotes.length}</p>
        </Link>
        <Link
          to="/pedidos"
          className="group rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <IconTruck className="h-4 w-4" />
            </span>
            <p className="text-eyebrow text-neutral-400">Meus pedidos</p>
          </div>
          <p className="tabular mt-3 text-[28px] font-bold leading-none text-ink-900">{myOrders.length}</p>
        </Link>
      </div>

      <h2 className="text-eyebrow mb-3.5 text-neutral-400">Mural de tarefas</h2>

      {columnError && (
        <div className="animate-fade-in mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          <IconAlert className="h-4 w-4 shrink-0" />
          {columnError}
          <button
            type="button"
            onClick={() => setColumnError(null)}
            className="ml-auto shrink-0 text-[12px] font-semibold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {addingColumn && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newColumnName.trim()) createColumn.mutate(newColumnName.trim())
          }}
          className="animate-fade-in mb-4 flex items-center gap-2 rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-sm"
        >
          <Input
            autoFocus
            placeholder="Nome do quadro"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAddingColumn(false)
            }}
            className="flex-1"
          />
          <Button type="submit" variant="primary" disabled={createColumn.isPending}>
            Criar quadro
          </Button>
        </form>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createTask.mutate()
          }}
          className="animate-fade-in mb-5 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <Input
                required
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
              />
            </Field>

            <Field label="Cliente (opcional)">
              <Input
                list="task-clients"
                value={draft.clientName}
                onChange={(e) => setDraft((s) => ({ ...s, clientName: e.target.value }))}
              />
              <datalist id="task-clients">
                {clientSuggestions?.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Quadro">
              <Select
                value={draft.columnId}
                onChange={(e) => setDraft((s) => ({ ...s, columnId: e.target.value }))}
              >
                {(columns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Prazo (data e hora, opcional)">
              <Input
                type="datetime-local"
                value={draft.dueDate}
                onChange={(e) => setDraft((s) => ({ ...s, dueDate: e.target.value }))}
              />
            </Field>

            <Field label="Tags (opcional)">
              {draftTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {draftTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-[12px] font-medium text-neutral-700"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setDraftTags((s) => s.filter((x) => x !== t))}
                        className="text-neutral-400 transition-colors hover:text-brand-600"
                        aria-label={`Remover tag ${t}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                list="task-tags"
                placeholder="Digite e aperte Enter"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDraftTag(tagDraft)
                  }
                }}
              />
              <datalist id="task-tags">
                {tagSuggestions?.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>

            <Field label="Vincular a orçamento">
              <Select value={draft.quoteId} onChange={(e) => setDraft((s) => ({ ...s, quoteId: e.target.value }))}>
                <option value="">—</option>
                {myQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber} — {q.clientName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Vincular a pedido">
              <Select value={draft.orderId} onChange={(e) => setDraft((s) => ({ ...s, orderId: e.target.value }))}>
                <option value="">—</option>
                {myOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} — {o.quote.clientName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Notas (opcional)" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="primary" disabled={createTask.isPending}>
              {createTask.isPending ? 'Criando…' : 'Criar tarefa'}
            </Button>
          </div>
        </form>
      )}

      {!columns && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[288px] shrink-0 rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-sm">
              <Skeleton className="h-2.5 w-24" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {(columns ?? []).map((col) => {
          const isCollapsed = !!collapsed[col.id]
          const colTasks = grouped[col.id] ?? []
          return (
            <div
              key={col.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                setDraggingColumnId(col.id)
              }}
              onDragEnd={() => setDraggingColumnId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingColumnId) handleColumnDrop(col.id)
                else handleDrop(col.id)
              }}
              className={cn(
                'shrink-0 cursor-grab rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-sm active:cursor-grabbing',
                'transition-[opacity,box-shadow,width] duration-200 ease-out',
                isCollapsed ? 'w-53' : 'w-[288px]',
                draggingColumnId === col.id ? 'opacity-40' : 'hover:shadow-md',
              )}
            >
              <div className="flex items-center gap-1 px-1">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(col.id)}
                  title={isCollapsed ? 'Expandir quadro' : 'Recolher quadro'}
                  aria-label={isCollapsed ? `Expandir quadro ${col.name}` : `Recolher quadro ${col.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-300 transition-[background-color,color] duration-150 hover:bg-neutral-500/10 hover:text-neutral-600"
                >
                  <IconChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform duration-300 ease-out', isCollapsed && '-rotate-90')}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <ColumnTitle column={col} />
                </div>
                <button
                  type="button"
                  onClick={() => toggleColumnDone.mutate({ id: col.id, isDone: !col.isDone })}
                  title={col.isDone ? 'Quadro marcado como concluído — clique para desmarcar' : 'Marcar quadro como concluído'}
                  aria-label={col.isDone ? `Desmarcar quadro ${col.name} como concluído` : `Marcar quadro ${col.name} como concluído`}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
                    col.isDone ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-300 hover:bg-neutral-500/10 hover:text-neutral-600',
                  )}
                >
                  <IconCheckCircle className="h-3.5 w-3.5" />
                </button>
                <span
                  className={cn(
                    'tabular shrink-0 rounded-full px-1.5 text-[11px] font-medium',
                    col.isDone ? 'bg-emerald-500/10 text-emerald-700' : 'bg-neutral-500/10 text-neutral-500',
                  )}
                >
                  {colTasks.length}
                </span>
                <button
                  type="button"
                  disabled={col.isDone}
                  onClick={() => setDeletingColumn(col)}
                  title={col.isDone ? 'Desmarque o quadro como concluído antes de excluí-lo' : 'Excluir quadro'}
                  aria-label={`Excluir quadro ${col.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-300 transition-[background-color,color] duration-150 hover:bg-brand-50 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-30"
                >
                  ×
                </button>
              </div>

              {!isCollapsed && (
                <div className="mt-2.5 min-h-16 space-y-2">
                  {colTasks.map((task) => {
                    const done = col.isDone
                    const overdue = isOverdue(task.dueDate, done)
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDraggingId(task.id)
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation()
                          setDraggingId(null)
                        }}
                        onClick={() => setEditingTaskId(task.id)}
                        className={cn(
                          'group cursor-pointer rounded-xl border border-neutral-200/70 p-3 shadow-xs',
                          'transition-[transform,box-shadow,border-color] duration-200 ease-out',
                          'hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md active:cursor-grabbing',
                          done ? 'bg-neutral-50/70' : 'bg-white',
                          draggingId === task.id && 'opacity-40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-[13.5px] font-medium leading-snug',
                              done ? 'text-neutral-400 line-through' : 'text-ink-900',
                            )}
                          >
                            {done && <IconCheckCircle className="mr-1 -mt-0.5 inline h-3.5 w-3.5 text-emerald-500" />}
                            {task.title}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTask.mutate(task.id)
                            }}
                            aria-label="Remover tarefa"
                            className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-300 opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-brand-50 hover:text-brand-600 group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </div>

                        {task.clientName && (
                          <p className="mt-1 text-[12px] text-neutral-500">{task.clientName}</p>
                        )}
                        {task.notes && (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-400">{task.notes}</p>
                        )}

                        {task.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {task.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-neutral-500/10 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {task.dueDate && (
                          <p
                            className={cn(
                              'mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium',
                              overdue ? 'text-brand-600' : 'text-neutral-400',
                            )}
                          >
                            {overdue && <IconAlert className="h-3 w-3" />}
                            {formatDueDate(task.dueDate)}
                            {overdue && ' · atrasado'}
                          </p>
                        )}

                        {(task.quoteNumber || task.orderNumber) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {task.quoteNumber && (
                              <Link
                                to="/orcamentos"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
                              >
                                Orç. {task.quoteNumber}
                              </Link>
                            )}
                            {task.orderNumber && (
                              <Link
                                to={`/pedidos/${task.orderId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-md bg-neutral-500/10 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-500/20"
                              >
                                Pedido #{task.orderNumber}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {colTasks.length === 0 && (
                    <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-5 text-center text-[12px] text-neutral-400">
                      Nada por aqui.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {columns && columns.length === 0 && (
          <div className="w-full overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <EmptyState
              icon={IconBoard}
              title="Nenhum quadro ainda"
              description="Crie o primeiro quadro para começar a organizar suas tarefas."
              action={
                <Button size="sm" variant="primary" onClick={() => setAddingColumn(true)}>
                  Novo quadro
                </Button>
              }
            />
          </div>
        )}
      </div>

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          columns={columns ?? []}
          myQuotes={myQuotes}
          myOrders={myOrders}
          clientSuggestions={clientSuggestions}
          tagSuggestions={tagSuggestions}
          onClose={() => setEditingTaskId(null)}
        />
      )}

      {deletingColumn && (
        <ConfirmDeleteModal
          title={`Excluir "${deletingColumn.name}"?`}
          description={
            (grouped[deletingColumn.id] ?? []).length > 0
              ? `Este quadro tem ${(grouped[deletingColumn.id] ?? []).length} tarefa(s). Mova ou exclua as tarefas antes de remover o quadro.`
              : 'Esta ação não pode ser desfeita.'
          }
          isPending={deleteColumn.isPending}
          onCancel={() => setDeletingColumn(null)}
          onConfirm={() => deleteColumn.mutate(deletingColumn.id)}
        />
      )}
    </Page>
  )
}
