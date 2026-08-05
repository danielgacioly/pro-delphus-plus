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
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { IconAlert, IconBoard, IconChevronDown } from '../components/icons'

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

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false
  return new Date(dueDate).getTime() < Date.now()
}

function formatDueDate(dueDate: string) {
  return new Date(dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

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
        className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
      className="cursor-text select-none truncate text-xs font-semibold uppercase tracking-wide text-neutral-500"
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
  const [title, setTitle] = useState(task.title)
  const [clientName, setClientName] = useState(task.clientName ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '')
  const [columnId, setColumnId] = useState(task.columnId)
  const [quoteId, setQuoteId] = useState(task.quoteId ?? '')
  const [orderId, setOrderId] = useState(task.orderId ?? '')
  const [tags, setTags] = useState<string[]>(task.tags)
  const [tagDraft, setTagDraft] = useState('')

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

  const updateTask = useMutation({
    mutationFn: async () =>
      api.patch(`/tasks/${task.id}`, {
        title,
        clientName: clientName || null,
        notes: notes || null,
        dueDate: dueDate || null,
        columnId,
        quoteId: quoteId || null,
        orderId: orderId || null,
        tags,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-clients'] })
      queryClient.invalidateQueries({ queryKey: ['task-tags'] })
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
        className="animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">Editar tarefa</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-brand-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Título</label>
            <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Cliente (opcional)</label>
            <input
              list="edit-task-clients-datalist"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={inputClass}
            />
            <datalist id="edit-task-clients-datalist">
              {clientSuggestions?.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Quadro</label>
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={inputClass}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Prazo (opcional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Tags (opcional)</label>
            {tags.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
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
            <input
              list="edit-task-tags-datalist"
              placeholder="Digite e aperte Enter"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag(tagDraft)
                }
              }}
              className={inputClass}
            />
            <datalist id="edit-task-tags-datalist">
              {tagSuggestions?.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Vincular a orçamento (opcional)</label>
            <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {myQuotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quoteNumber} — {q.clientName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Vincular a pedido (opcional)</label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {myOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber} — {o.quote.clientName}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Notas (opcional)</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={updateTask.isPending}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-black active:scale-[0.98] disabled:opacity-60"
          >
            {updateTask.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function MyDesk() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

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

  const editingTask = useMemo(() => tasks?.find((t) => t.id === editingTaskId) ?? null, [tasks, editingTaskId])

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })

  const createTask = useMutation({
    mutationFn: async () => {
      const payload: CreatePersonalTaskInput = {
        title: draft.title,
        clientName: draft.clientName || undefined,
        notes: draft.notes || undefined,
        tags: draftTags.length ? draftTags : undefined,
        dueDate: draft.dueDate || undefined,
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
    },
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; columnId: string; position: number }) =>
      api.patch(`/tasks/${id}`, patch),
    onSuccess: invalidateTasks,
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: invalidateTasks,
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

  const [columnError, setColumnError] = useState<string | null>(null)

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/board-columns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-columns'] })
      setColumnError(null)
      setDeletingColumn(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível excluir o quadro.'
      setColumnError(message)
      setDeletingColumn(null)
    },
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

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Minha Pro Delphus</h1>
      <p className="mt-1 text-neutral-500">
        Bem-vindo ao seu espaço pessoal! Veja pendências, lembretes e tenha acesso rápido ao que você já criou.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/orcamentos"
          className="group rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-brand-900/5"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Meus orçamentos</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{myQuotes.length}</p>
        </Link>
        <Link
          to="/pedidos"
          className="group rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-brand-900/5"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Meus pedidos</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{myOrders.length}</p>
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Mural de tarefas</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddingColumn((s) => !s)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            {addingColumn ? 'Cancelar' : '+ Novo quadro'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
          >
            {showForm ? 'Cancelar' : '+ Nova tarefa'}
          </button>
        </div>
      </div>

      {columnError && (
        <div className="animate-fade-in-up mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <IconAlert className="h-4 w-4 shrink-0" />
          {columnError}
          <button
            type="button"
            onClick={() => setColumnError(null)}
            className="ml-auto shrink-0 text-xs font-semibold hover:underline"
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
          className="animate-fade-in-up mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3"
        >
          <input
            autoFocus
            placeholder="Nome do quadro"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAddingColumn(false)
            }}
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            disabled={createColumn.isPending}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
          >
            Criar quadro
          </button>
        </form>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createTask.mutate()
          }}
          className="animate-fade-in-up mt-3 rounded-xl border border-neutral-200 bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600">Título</label>
              <input
                required
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Cliente (opcional)</label>
              <input
                list="task-clients-datalist"
                value={draft.clientName}
                onChange={(e) => setDraft((s) => ({ ...s, clientName: e.target.value }))}
                className={inputClass}
              />
              <datalist id="task-clients-datalist">
                {clientSuggestions?.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Quadro</label>
              <select
                value={draft.columnId}
                onChange={(e) => setDraft((s) => ({ ...s, columnId: e.target.value }))}
                className={inputClass}
              >
                {(columns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Prazo (opcional)</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((s) => ({ ...s, dueDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Tags (opcional)</label>
              {draftTags.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {draftTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
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
              <input
                list="task-tags-datalist"
                placeholder="Digite e aperte Enter"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDraftTag(tagDraft)
                  }
                }}
                className={inputClass}
              />
              <datalist id="task-tags-datalist">
                {tagSuggestions?.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Vincular a orçamento (opcional)</label>
              <select
                value={draft.quoteId}
                onChange={(e) => setDraft((s) => ({ ...s, quoteId: e.target.value }))}
                className={inputClass}
              >
                <option value="">—</option>
                {myQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber} — {q.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Vincular a pedido (opcional)</label>
              <select
                value={draft.orderId}
                onChange={(e) => setDraft((s) => ({ ...s, orderId: e.target.value }))}
                className={inputClass}
              >
                <option value="">—</option>
                {myOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} — {o.quote.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600">Notas (opcional)</label>
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createTask.isPending}
            className="mt-4 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-black active:scale-[0.99] disabled:opacity-60"
          >
            {createTask.isPending ? 'Criando…' : 'Criar tarefa'}
          </button>
        </form>
      )}

      {!columns && (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-72 shrink-0 rounded-xl border border-neutral-200 bg-white p-3">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="mt-4 space-y-2">
                <div className="skeleton h-14 rounded-lg" />
                <div className="skeleton h-14 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-4 overflow-x-auto pb-2">
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
              className={`w-72 shrink-0 cursor-grab rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-all active:cursor-grabbing ${
                draggingColumnId === col.id ? 'opacity-40' : 'hover:shadow-md'
              }`}
            >
              <div className="mb-1 flex items-center gap-1 px-1">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(col.id)}
                  title={isCollapsed ? 'Expandir quadro' : 'Recolher quadro'}
                  aria-label={isCollapsed ? `Expandir quadro ${col.name}` : `Recolher quadro ${col.name}`}
                  className="shrink-0 text-neutral-300 transition-colors hover:text-neutral-600"
                >
                  <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <ColumnTitle column={col} />
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-500">
                  {colTasks.length}
                </span>
                <button
                  type="button"
                  onClick={() => setDeletingColumn(col)}
                  title="Excluir quadro"
                  aria-label={`Excluir quadro ${col.name}`}
                  className="shrink-0 text-neutral-300 transition-colors hover:text-brand-600"
                >
                  ×
                </button>
              </div>
              {!isCollapsed && (
                <div className="min-h-15 mt-2 space-y-2">
                  {colTasks.map((task) => {
                    const overdue = isOverdue(task.dueDate)
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
                        className={`cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md active:cursor-grabbing ${
                          draggingId === task.id ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-ink-900">{task.title}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTask.mutate(task.id)
                            }}
                            className="shrink-0 text-neutral-300 transition-colors hover:text-brand-600"
                            aria-label="Remover tarefa"
                          >
                            ×
                          </button>
                        </div>
                        {task.clientName && <p className="mt-1 text-xs text-neutral-500">{task.clientName}</p>}
                        {task.notes && <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{task.notes}</p>}
                        {task.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {task.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-ink-900/5 px-2 py-0.5 text-[11px] font-medium text-ink-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {task.dueDate && (
                          <p
                            className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${
                              overdue ? 'text-brand-600' : 'text-neutral-400'
                            }`}
                          >
                            {overdue && <span aria-hidden>⚠</span>}
                            Prazo: {formatDueDate(task.dueDate)}
                            {overdue && ' — atrasado'}
                          </p>
                        )}
                        {(task.quoteNumber || task.orderNumber) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {task.quoteNumber && (
                              <Link
                                to="/orcamentos"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
                              >
                                Orç. {task.quoteNumber}
                              </Link>
                            )}
                            {task.orderNumber && (
                              <Link
                                to={`/pedidos/${task.orderId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-200"
                              >
                                Pedido #{task.orderNumber}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {colTasks.length === 0 && <p className="px-1 py-2 text-xs text-neutral-400">Nada por aqui.</p>}
                </div>
              )}
            </div>
          )
        })}
        {columns && columns.length === 0 && (
          <div className="w-full">
            <EmptyState
              icon={IconBoard}
              title="Nenhum quadro ainda"
              description='Clique em "+ Novo quadro" para começar a organizar suas tarefas.'
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
    </div>
  )
}
