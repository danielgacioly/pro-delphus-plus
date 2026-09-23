import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { Alert, Badge, Button, Textarea, buttonClasses } from '../components/ui'
import { NeoAvatar, NeoListening, NeoMascot } from '../components/NeoMascot'
import { NeoAsciiBackground } from '../components/NeoAsciiBackground'
import { IconArrowUp, IconCheckCircle, IconMic } from '../components/icons'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { useNeoChat } from '../context/NeoChatContext'
import { KIND_LABEL } from '../context/neoChat'

// O Gemini responde em markdown, e o pouco que ele usa de verdade — negrito,
// itálico e listas — aparecia cru na tela ("**Peso bruto**", "*(piada)*",
// "* Endereço"). Ordem importa: casa `**negrito**` antes de `*itálico*` pra
// não sobrar um asterisco solto de cada lado de um trecho em negrito.
function renderInlineFormatting(text: string) {
  const withBullets = text.replace(/^[ \t]*[*-][ \t]+/gm, '• ')
  return withBullets.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

export function Neo() {
  // A conversa e a chamada em andamento vivem no provider (acima das rotas):
  // sair desta página não interrompe o NEO.
  const { messages, pending, loading, error, setError, send, confirm, cancel, newChat } = useNeoChat()
  const [input, setInput] = useState('')
  // O modelo gratuito do NEO às vezes passa bem dos poucos segundos normais
  // (fila de alta demanda do lado do Google) — sem um sinal de "ainda
  // trabalhando", passados uns segundos os três pontinhos parecem travados.
  const [slowLoading, setSlowLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const speech = useVoiceDictation({ onTranscript: setInput, onError: setError })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending, error, loading])

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false)
      return
    }
    const timer = setTimeout(() => setSlowLoading(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

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

  function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    speech.stop()
    setInput('')
    void send(text)
  }

  function handleNewChat() {
    newChat()
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-canvas">
      <NeoAsciiBackground />

      <header className="relative z-10 shrink-0 border-b border-neutral-200/70 bg-canvas/88 backdrop-blur-sm px-6 pt-8 pb-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3.5">
          {/* Só respira enquanto o NEO está pensando: o movimento vira sinal de
              estado, não enfeite se mexendo o tempo todo. */}
          <NeoAvatar thinking={loading} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <h1 className="text-display text-ink-900">NEO</h1>
            <p className="mt-0.5 text-[13px] text-neutral-600">Network Executive Operator · Seu assistente pessoal na Pro Delphus+</p>
          </div>
          {messages.length > 0 && (
            <Button size="md" onClick={handleNewChat} disabled={loading}>
              Nova conversa
            </Button>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-6 sm:px-8">
        <div className="relative my-5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-5">
          {(speech.recording || speech.transcribing) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-white">
              <NeoListening
                active={speech.recording || speech.transcribing}
                className="h-48 w-48 -translate-x-6 animate-scale-in sm:h-56 sm:w-56"
              />
              <h2 className="text-heading mt-1 text-ink-900">{speech.recording ? 'Ouvindo…' : 'Transcrevendo…'}</h2>
            </div>
          )}

          {messages.length === 0 && !pending && (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <NeoMascot className="h-40 w-40 sm:h-48 sm:w-48" />
              <h2 className="text-heading mt-1 text-ink-900">Oi, eu sou o NEO</h2>
              <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-neutral-600">
                Pergunte sobre produtos, setores ou clientes — ou peça pra eu montar um orçamento ou pedido pra você.
              </p>
              <div className="mt-5 grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Consultar um produto', prompt: 'Quero consultar um produto.' },
                  { label: 'Buscar um cliente', prompt: 'Quero buscar um cliente.' },
                  { label: 'Montar um orçamento', prompt: 'Quero montar um orçamento.' },
                  { label: 'Criar um pedido', prompt: 'Quero criar um pedido.' },
                ].map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => {
                      setInput(suggestion.prompt)
                      textareaRef.current?.focus()
                    }}
                    className={buttonClasses({ size: 'sm', className: 'w-full justify-center' })}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
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
                  {m.role === 'model' ? renderInlineFormatting(m.text) : m.text}
                </div>
              ),
            )}

            {loading && (
              <div className="flex flex-col items-start gap-1.5 self-start">
                <div className="animate-neo-float flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-neutral-500/8 px-4 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                </div>
                {slowLoading && (
                  <p className="px-1 text-[12px] text-neutral-500">
                    Tá demorando mais que o normal — o NEO ainda está tentando responder…
                  </p>
                )}
              </div>
            )}

            {pending && (
              <div className="max-w-[85%] rounded-2xl border border-brand-600/15 bg-brand-50/60 p-4">
                <Badge tone="brand">{KIND_LABEL[pending.kind]}</Badge>
                <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-900">{pending.summary}</p>
                <div className="mt-3.5 flex gap-2">
                  <Button size="sm" onClick={() => void cancel()} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => void confirm()} disabled={loading}>
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
          {/* Campo em cápsula com o enviar por dentro, como no iMessage: o anel
              de foco fica no contêiner, não no textarea. */}
          <div className="flex items-end gap-1 rounded-[20px] border border-black/[0.12] bg-white p-1 pl-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] duration-100 focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/20">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              readOnly={speech.recording}
              aria-busy={speech.recording || undefined}
              placeholder={speech.recording ? 'Ouvindo…' : 'Pergunte alguma coisa ao NEO…'}
              className={cn(
                'max-h-32 flex-1 resize-none overflow-y-auto border-0 px-2.5 py-1.5 text-[14px] leading-relaxed shadow-none [scrollbar-width:none] hover:border-0 focus:border-0 focus:ring-0',
                speech.recording ? 'skeleton' : 'bg-transparent',
              )}
            />
            {speech.supported && (
              <button
                type="button"
                onClick={() => speech.toggle(input)}
                disabled={loading || speech.transcribing}
                aria-label={speech.recording ? 'Parar ditado por voz' : 'Ditar mensagem por voz'}
                aria-pressed={speech.recording}
                title={speech.recording ? 'Parar' : 'Ditar por voz'}
                className={cn(
                  'mb-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  'transition-[background-color,color,opacity] duration-100 ease-out',
                  'disabled:pointer-events-none disabled:opacity-30',
                  speech.recording
                    ? 'animate-pulse bg-danger-500 text-white hover:bg-danger-600'
                    : 'text-neutral-500 hover:bg-black/[0.05] hover:text-ink-900',
                )}
              >
                <IconMic className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem"
              title="Enviar"
              className={cn(
                'mb-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white',
                'transition-[background-color,opacity] duration-100 ease-out',
                'hover:bg-brand-700',
                'disabled:pointer-events-none disabled:opacity-30',
              )}
            >
              <IconArrowUp className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
