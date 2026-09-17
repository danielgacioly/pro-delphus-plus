import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  formatOrderNumber,
  type OrderDTO,
  type PersonalBoardColumnDTO,
  type PersonalTaskDTO,
  type QuoteDTO,
} from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { toDatetimeLocalValue, toIsoFromDatetimeLocal } from '../lib/datetimeLocal'
import { Modal } from './Modal'
import { Button, Field, Input, Select, Textarea } from './ui'

export function EditTaskModal({
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
        className="animate-scale-in max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-title text-ink-900">Editar tarefa</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-neutral-500/10 hover:text-ink-900"
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
                  #{formatOrderNumber(o.orderNumber)} — {o.quote.clientName}
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
