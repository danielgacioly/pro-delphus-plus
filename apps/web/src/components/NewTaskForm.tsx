import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  formatOrderNumber,
  type CreatePersonalTaskInput,
  type OrderDTO,
  type PersonalBoardColumnDTO,
  type QuoteDTO,
} from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { toIsoFromDatetimeLocal } from '../lib/datetimeLocal'
import { Button, Field, Input, Select, Textarea } from './ui'

const emptyDraft = { title: '', clientName: '', notes: '', quoteId: '', orderId: '', columnId: '', dueDate: '' }

/**
 * Cadastro de tarefa do mural pessoal.
 *
 * Vive fora da página porque é o único lugar que precisa do rascunho: com o
 * estado aqui dentro, fechar o formulário descarta tudo sem a página ter que
 * saber o que existe dentro dele.
 */
export function NewTaskForm({
  columns,
  quotes,
  orders,
  clientSuggestions,
  tagSuggestions,
  onCreated,
  onCancel,
}: {
  columns: PersonalBoardColumnDTO[]
  quotes: QuoteDTO[]
  orders: OrderDTO[]
  clientSuggestions: string[] | undefined
  tagSuggestions: string[] | undefined
  onCreated: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [draft, setDraft] = useState(emptyDraft)
  const [tagDraft, setTagDraft] = useState('')
  const [draftTags, setDraftTags] = useState<string[]>([])

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
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-clients'] })
      queryClient.invalidateQueries({ queryKey: ['task-tags'] })
      toast.success('Tarefa criada.')
      onCreated()
    },
  })

  function addDraftTag(raw: string) {
    const typed = raw.trim()
    if (!typed || draftTags.includes(typed)) {
      setTagDraft('')
      return
    }
    setDraftTags((s) => [...s, typed])
    setTagDraft('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createTask.mutate()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
      className="animate-fade-in mb-5 rounded-2xl border border-black/[0.06] bg-white p-5"
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
            {columns.map((c) => (
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
                    className="text-neutral-500 transition-colors hover:text-brand-600"
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
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quoteNumber} — {q.clientName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Vincular a pedido">
          <Select value={draft.orderId} onChange={(e) => setDraft((s) => ({ ...s, orderId: e.target.value }))}>
            <option value="">—</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                #{formatOrderNumber(o.orderNumber)} — {o.quote.clientName}
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

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={createTask.isPending}>
          {createTask.isPending ? 'Criando…' : 'Criar tarefa'}
        </Button>
      </div>
    </form>
  )
}
