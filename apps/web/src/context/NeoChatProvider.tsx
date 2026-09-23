import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../lib/api'
import {
  KIND_LABEL,
  STORAGE_KEY,
  cancelAction,
  confirmAction,
  describeConfirmResult,
  loadChat,
  sendMessage,
  type ChatMessage,
  type PendingAction,
} from './neoChat'
import { NeoChatContext } from './NeoChatContext'
import { useToast } from './ToastContext'

/**
 * A conversa e a chamada em andamento moram aqui, acima das rotas, e não na
 * página do NEO: sair da tela enquanto ele pensa desmontava a página, e a
 * resposta se perdia. Agora a chamada continua, a resposta entra na conversa e,
 * se a pessoa estiver em outra tela, um aviso diz que ele terminou.
 */
export function NeoChatProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat().messages)
  const [pending, setPending] = useState<PendingAction | null>(() => loadChat().pending)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs porque o fim da chamada acontece muito depois do render em que ela
  // começou — precisa da conversa e da rota de agora, não das de então.
  const messagesRef = useRef(messages)
  const onNeoPageRef = useRef(location.pathname === '/neo')
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => {
    onNeoPageRef.current = location.pathname === '/neo'
  }, [location.pathname])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, pending }))
    } catch {
      // storage cheio ou bloqueado — a conversa só não sobrevive à navegação
    }
  }, [messages, pending])

  const notifyIfAway = useCallback(
    (message: string, tone: 'success' | 'error') => {
      if (onNeoPageRef.current) return
      const action = { label: 'Ver', onClick: () => navigate('/neo') }
      if (tone === 'success') toast.success(message, action)
      else toast.error(message, action)
    },
    [navigate, toast],
  )

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || loading) return
      const history = messagesRef.current
      setError(null)
      setMessages([...history, { role: 'user', text }])
      setLoading(true)
      try {
        const { reply, pendingAction } = await sendMessage(text, history)
        setMessages((prev) => [...prev, { role: 'model', text: reply }])
        setPending(pendingAction ?? null)
        notifyIfAway('O NEO terminou de pensar e já respondeu.', 'success')
      } catch (err) {
        const message = getErrorMessage(err, 'NEO não conseguiu responder agora. Tenta de novo em instantes.')
        setError(message)
        notifyIfAway('O NEO não conseguiu responder. Abra a conversa para tentar de novo.', 'error')
      } finally {
        setLoading(false)
      }
    },
    [loading, notifyIfAway],
  )

  const confirm = useCallback(async () => {
    if (!pending) return
    setLoading(true)
    setError(null)
    try {
      const result = await confirmAction(pending.id)
      setMessages((prev) => [...prev, { role: 'model', text: describeConfirmResult(pending.kind, result), event: 'done' }])
      setPending(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Não deu pra confirmar agora. Tenta de novo ou peça pro NEO montar de novo.'))
    } finally {
      setLoading(false)
    }
  }, [pending])

  const cancel = useCallback(async () => {
    if (!pending) return
    await cancelAction(pending.id).catch(() => {})
    setMessages((prev) => [...prev, { role: 'model', text: `${KIND_LABEL[pending.kind]} — cancelado, nada foi gravado.`, event: 'cancelled' }])
    setPending(null)
  }, [pending])

  const newChat = useCallback(() => {
    // A prévia pendente é descartada junto: guardá-la fora da conversa que a
    // gerou é o caminho pra alguém confirmar sem lembrar do que se tratava.
    if (pending) void cancelAction(pending.id).catch(() => {})
    setMessages([])
    setPending(null)
    setError(null)
  }, [pending])

  return (
    <NeoChatContext.Provider value={{ messages, pending, loading, error, setError, send, confirm, cancel, newChat }}>
      {children}
    </NeoChatContext.Provider>
  )
}
