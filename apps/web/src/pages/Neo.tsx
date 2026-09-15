import { useEffect, useRef, useState } from 'react'
import { api, getErrorMessage } from '../lib/api'
import { cn } from '../lib/cn'
import { Badge, Button, EmptyState } from '../components/ui'
import { IconAlert, IconArrowUp, IconBot, IconCheckCircle } from '../components/icons'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

interface PendingAction {
  id: string
  kind: 'orcamento_criar' | 'orcamento_editar' | 'pedido_criar' | 'pedido_editar' | 'cliente_editar'
  summary: string
}

const KIND_LABEL: Record<PendingAction['kind'], string> = {
  orcamento_criar: 'Criar orçamento',
  orcamento_editar: 'Editar orçamento',
  pedido_criar: 'Criar pedido',
  pedido_editar: 'Editar pedido',
  cliente_editar: 'Editar cliente',
}

async function sendMessage(message: string, history: ChatMessage[]) {
  const { data } = await api.post<{ reply: string; pendingAction?: PendingAction }>('/neo', { message, history })
  return data
}

async function confirmAction(id: string) {
  const { data } = await api.post(`/neo/actions/${id}/confirm`)
  return data
}

async function cancelAction(id: string) {
  await api.post(`/neo/actions/${id}/cancel`)
}

export function Neo() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending, error, actionResult])

  // Cresce junto com o texto (como o campo de mensagem do Mensagens/iMessage),
  // até o teto de altura definido no CSS — dali pra frente rola por dentro.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    setActionResult(null)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const { reply, pendingAction } = await sendMessage(text, messages)
      setMessages((prev) => [...prev, { role: 'model', text: reply }])
      setPending(pendingAction ?? null)
    } catch (err) {
      setError(getErrorMessage(err, 'Neo não conseguiu responder agora. Tenta de novo em instantes.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!pending) return
    setLoading(true)
    setError(null)
    try {
      await confirmAction(pending.id)
      setActionResult(`${KIND_LABEL[pending.kind]} — feito.`)
      setPending(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Não deu pra confirmar agora. Tenta de novo ou peça pro Neo montar de novo.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!pending) return
    await cancelAction(pending.id).catch(() => {})
    setPending(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    // Altura absoluta (não `h-full`): o wrapper que o React Router insere em
    // Layout.tsx não tem altura própria, então uma % não teria de quê herdar.
    // `main` já ocupa exatamente 100vh (não há barra superior), então isto
    // bate com o espaço real disponível e deixa só o histórico rolar.
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-neutral-200/70 px-6 pt-8 pb-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3.5">
          <div
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[15px] font-semibold text-white shadow-sm"
            aria-hidden
          >
            {/* Espaço reservado pro avatar animado do Neo — troca por um GIF quando ele existir. */}
            N
          </div>
          <div className="min-w-0">
            <h1 className="text-display text-ink-900">Neo</h1>
            <p className="mt-0.5 text-[13px] text-neutral-500">Assistente da Pro Delphus+</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-6 sm:px-8">
        <div className="my-5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          {messages.length === 0 && !pending && (
            <EmptyState
              icon={IconBot}
              title="Comece uma conversa"
              description="Pergunte sobre produtos, setores ou clientes — ou peça pro Neo montar um orçamento ou pedido pra você."
            />
          )}

          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed',
                  m.role === 'user'
                    ? 'ml-auto rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md bg-neutral-500/8 text-ink-900',
                )}
              >
                {m.text}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-neutral-500/8 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
              </div>
            )}

            {pending && (
              <div className="max-w-[85%] rounded-2xl border border-brand-600/15 bg-brand-50/60 p-4">
                <Badge tone="brand">{KIND_LABEL[pending.kind]}</Badge>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-900">{pending.summary}</p>
                <div className="mt-3.5 flex gap-2">
                  <Button size="sm" onClick={handleCancel} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="primary" onClick={handleConfirm} disabled={loading}>
                    Confirmar
                  </Button>
                </div>
              </div>
            )}

            {actionResult && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-700">
                <IconCheckCircle className="h-4 w-4 shrink-0" />
                {actionResult}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-[13px] text-brand-700">
                <IconAlert className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 pb-6">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Pergunte alguma coisa ao Neo…"
              className={cn(
                'max-h-32 w-full flex-1 resize-none overflow-y-auto rounded-lg border border-neutral-200 bg-white px-4 py-2.5',
                'text-[13.5px] leading-relaxed text-ink-900 shadow-xs placeholder:text-neutral-400',
                'transition-[border-color,box-shadow] duration-150 ease-out hover:border-neutral-300',
                'focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
              )}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem"
              title="Enviar"
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm',
                'transition-[transform,background-color,box-shadow] duration-150 ease-out',
                'hover:bg-brand-700 hover:shadow-md active:scale-90',
                'disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              <IconArrowUp className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
