import { useEffect, useRef, useState } from 'react'
import { api, getErrorMessage } from '../lib/api'
import { cn } from '../lib/cn'
import { Alert, Badge, Button } from '../components/ui'
import { NeoAvatar, NeoMascot } from '../components/NeoMascot'
import { IconArrowUp, IconCheckCircle } from '../components/icons'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
  // Resultado de um clique em Confirmar/Cancelar. Aparece como aviso, não como
  // bolha, mas vai no histórico: sem isso o Neo não sabia que o orçamento foi
  // criado (nem o número dele) e não conseguia seguir pro pedido.
  event?: 'done' | 'cancelled'
}

type ConfirmResult =
  | { resource: 'quote'; quote: { quoteNumber: string } }
  | { resource: 'order'; order: { orderNumber: number } }
  | { resource: 'client'; client: { name: string } }

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
  const { data } = await api.post<{ reply: string; pendingAction?: PendingAction }>('/neo', {
    message,
    history: history.map((m) => ({ role: m.role, text: m.event ? `[Sistema] ${m.text}` : m.text })),
  })
  return data
}

async function confirmAction(id: string) {
  const { data } = await api.post<ConfirmResult>(`/neo/actions/${id}/confirm`)
  return data
}

function describeConfirmResult(kind: PendingAction['kind'], result: ConfirmResult) {
  const label = KIND_LABEL[kind]
  if (result.resource === 'quote') return `${label} — feito: orçamento ${result.quote.quoteNumber}.`
  if (result.resource === 'order') return `${label} — feito: pedido ${result.order.orderNumber}.`
  return `${label} — feito: ${result.client.name}.`
}

async function cancelAction(id: string) {
  await api.post(`/neo/actions/${id}/cancel`)
}

// O Gemini responde em markdown, e o pouco que ele usa de verdade — negrito e
// listas — aparecia cru na tela ("**Peso bruto**", "* Endereço").
function renderInlineBold(text: string) {
  const withBullets = text.replace(/^[ \t]*[*-][ \t]+/gm, '• ')
  return withBullets.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

// A conversa vive enquanto a aba viver: sair pra Orçamentos e voltar mantém o
// fio (antes zerava, porque a página desmonta). sessionStorage e não
// localStorage de propósito — fechou o navegador, conversa nova.
const STORAGE_KEY = 'neo:conversa'

interface StoredChat {
  messages: ChatMessage[]
  pending: PendingAction | null
}

function loadChat(): StoredChat {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { messages: [], pending: null }
    const parsed = JSON.parse(raw) as Partial<StoredChat>
    return { messages: parsed.messages ?? [], pending: parsed.pending ?? null }
  } catch {
    return { messages: [], pending: null }
  }
}

export function Neo() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat().messages)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(() => loadChat().pending)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending, error, loading])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, pending }))
    } catch {
      // storage cheio ou bloqueado — a conversa só não sobrevive à navegação
    }
  }, [messages, pending])

  // Cresce junto com o texto (como o campo de mensagem do Mensagens/iMessage),
  // até o teto de altura definido no CSS — dali pra frente rola por dentro.
  // Remede também quando a largura muda: na montagem o layout ainda está se
  // acomodando e a medida sai com o campo estreito demais (altura inflada).
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const autosize = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    autosize()
    let lastWidth = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return
      lastWidth = el.clientWidth
      autosize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [input])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const { reply, pendingAction } = await sendMessage(text, messages)
      setMessages((prev) => [...prev, { role: 'model', text: reply }])
      setPending(pendingAction ?? null)
    } catch (err) {
      setError(getErrorMessage(err, 'NEO não conseguiu responder agora. Tenta de novo em instantes.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!pending) return
    setLoading(true)
    setError(null)
    try {
      const result = await confirmAction(pending.id)
      setMessages((prev) => [...prev, { role: 'model', text: describeConfirmResult(pending.kind, result), event: 'done' }])
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
    setMessages((prev) => [...prev, { role: 'model', text: `${KIND_LABEL[pending.kind]} — cancelado, nada foi gravado.`, event: 'cancelled' }])
    setPending(null)
  }

  function handleNewChat() {
    // A prévia pendente é descartada junto: guardá-la fora da conversa que a
    // gerou é o caminho pra alguém confirmar sem lembrar do que se tratava.
    if (pending) void cancelAction(pending.id).catch(() => {})
    setMessages([])
    setPending(null)
    setError(null)
    setInput('')
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
          {/* Só respira enquanto o Neo está pensando: o movimento vira sinal de
              estado, não enfeite se mexendo o tempo todo. */}
          <NeoAvatar thinking={loading} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <h1 className="text-display text-ink-900">NEO</h1>
            <p className="mt-0.5 text-[13px] text-neutral-500">Ou Network Executive Operator. Seu assistente pessoal na Pro Delphus+</p>
          </div>
          {messages.length > 0 && (
            <Button size="sm" onClick={handleNewChat} disabled={loading}>
              Nova conversa
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-6 sm:px-8">
        <div className="my-5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          {messages.length === 0 && !pending && (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <NeoMascot className="h-40 w-40 sm:h-48 sm:w-48" />
              <h2 className="text-heading mt-1 text-ink-900">Oi, eu sou o NEO</h2>
              <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">
                Pergunte sobre produtos, setores ou clientes — ou peça pra eu montar um orçamento ou pedido pra você.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {messages.map((m, i) =>
              m.event ? (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px]',
                    m.event === 'done' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-neutral-500/8 text-neutral-600',
                  )}
                >
                  {m.event === 'done' && <IconCheckCircle className="h-4 w-4 shrink-0" />}
                  {m.text}
                </div>
              ) : (
                <div
                  key={i}
                  className={cn(
                    'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto rounded-br-md bg-brand-600 text-white'
                      : 'self-start rounded-bl-md bg-neutral-500/8 text-ink-900',
                  )}
                >
                  {m.role === 'model' ? renderInlineBold(m.text) : m.text}
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-center gap-1.5 self-start rounded-2xl rounded-bl-md bg-neutral-500/8 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
              </div>
            )}

            {pending && (
              <div className="max-w-[85%] rounded-2xl border border-brand-600/15 bg-brand-50/60 p-4">
                <Badge tone="brand">{KIND_LABEL[pending.kind]}</Badge>
                <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-900">{pending.summary}</p>
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

            {error && <Alert tone="error">{error}</Alert>}
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
              placeholder="Pergunte alguma coisa ao NEO…"
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
              <IconArrowUp className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
