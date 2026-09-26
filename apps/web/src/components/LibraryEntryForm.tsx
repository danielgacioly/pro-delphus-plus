import { useMemo, useState, type FormEvent } from 'react'
import type { LibraryTopicDTO } from '@prodelphusplus/shared'
import { Alert, Button, Combobox, Field, Textarea } from './ui'
import { IconBox, IconContacts } from './icons'
import { topicKey, topicOption, type LibraryFormValues } from './libraryForm.model'

export function LibraryEntryForm({
  initialValues,
  topics,
  isPending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues: LibraryFormValues
  /** Todos os produtos e clientes que podem virar tópico. */
  topics: LibraryTopicDTO[]
  isPending?: boolean
  error?: string | null
  submitLabel: string
  onSubmit: (values: LibraryFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState(initialValues)
  const [topicSearch, setTopicSearch] = useState('')
  const [touched, setTouched] = useState(false)

  const selectedKeys = useMemo(() => new Set(values.topics.map(topicKey)), [values.topics])
  const available = useMemo(
    () => topics.filter((t) => !selectedKeys.has(topicKey(t))).map(topicOption),
    [topics, selectedKeys],
  )

  const missing = {
    question: !values.question.trim(),
    answer: !values.answer.trim(),
    topics: values.topics.length === 0,
  }

  function addTopic(key: string) {
    const topic = topics.find((t) => topicKey(t) === key)
    if (topic) setValues((v) => ({ ...v, topics: [...v.topics, topic] }))
    setTopicSearch('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (missing.question || missing.answer || missing.topics) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="Pergunta"
        htmlFor="library-question"
        hint="Do jeito que o cliente perguntou — a busca entende outras formas de dizer a mesma coisa."
        error={touched && missing.question ? 'Escreva a pergunta.' : undefined}
      >
        <Textarea
          id="library-question"
          autoFocus
          rows={2}
          value={values.question}
          onChange={(e) => setValues((v) => ({ ...v, question: e.target.value }))}
          placeholder="Ex.: O simulador permite treinar sutura intradérmica?"
        />
      </Field>

      <Field
        label="Resposta"
        htmlFor="library-answer"
        error={touched && missing.answer ? 'Escreva a resposta.' : undefined}
      >
        <Textarea
          id="library-answer"
          rows={5}
          value={values.answer}
          onChange={(e) => setValues((v) => ({ ...v, answer: e.target.value }))}
          placeholder="A resposta confirmada pela empresa."
        />
      </Field>

      <Field
        label="Tópicos"
        hint="O produto ou cliente de que a pergunta trata. Pode ser mais de um."
        error={touched && missing.topics ? 'Escolha pelo menos um produto ou cliente.' : undefined}
      >
        {values.topics.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {values.topics.map((topic) => {
              const Icon = topic.type === 'product' ? IconBox : IconContacts
              return (
                <span
                  key={topicKey(topic)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-black/[0.05] pr-1 pl-2 text-[13px] text-ink-900"
                >
                  <Icon className="h-3.5 w-3.5 text-neutral-600" />
                  {topic.name}
                  <button
                    type="button"
                    aria-label={`Remover ${topic.name}`}
                    onClick={() => setValues((v) => ({ ...v, topics: v.topics.filter((t) => topicKey(t) !== topicKey(topic)) }))}
                    className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-black/[0.07] hover:text-ink-900"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        )}
        <Combobox
          options={available}
          inputValue={topicSearch}
          onInputValueChange={setTopicSearch}
          onSelect={addTopic}
          placeholder="Buscar produto ou cliente…"
          emptyMessage="Nenhum produto ou cliente com esse nome."
        />
      </Field>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" isLoading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
