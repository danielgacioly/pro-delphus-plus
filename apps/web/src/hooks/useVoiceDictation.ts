import { useEffect, useRef, useState } from 'react'
import { api, getErrorMessage } from '../lib/api'

// Chat de mensagem curta não precisa de mais que isso — é um teto de
// segurança contra gravação esquecida ligada, não um limite de uso normal.
const MAX_RECORDING_MS = 90_000

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

/**
 * Ditado por voz do NEO: grava com MediaRecorder e manda pro Whisper
 * (via Groq, /neo/voz) transcrever quando o microfone desliga — melhor
 * qualidade que o reconhecimento embutido do navegador, e ainda de graça
 * (free tier do Groq, cota separada da do Gemini). Exige contexto seguro
 * (HTTPS ou localhost), como qualquer captura de microfone.
 */
export function useVoiceDictation(params: { onTranscript: (text: string) => void; onError?: (message: string) => void }) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [supported] = useState(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined',
  )
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  // O texto que já estava no campo antes de gravar — entra na frente do
  // transcrito, pra não perder o que a pessoa já tinha digitado.
  const baseTextRef = useRef('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Esc chama .stop() pra soltar o microfone, mas não deve transcrever o que
  // já foi gravado — essa flag é o que o onstop olha pra decidir se manda.
  const cancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // Só solta o microfone — não chama .stop() do recorder, que dispararia
      // onstop e tentaria transcrever depois que o componente já saiu.
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  // Esc cancela a gravação em andamento — só liga o listener enquanto o
  // microfone está ativo, pra não interceptar Esc no resto da tela do NEO.
  useEffect(() => {
    if (!recording) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') cancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [recording])

  async function transcribe(blob: Blob) {
    if (blob.size === 0) return
    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'ditado')
      const { data } = await api.post<{ text: string }>('/neo/voz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const text = data.text?.trim()
      if (!text) return
      const base = baseTextRef.current
      const separator = base && !base.endsWith(' ') ? ' ' : ''
      params.onTranscript(base + separator + text)
    } catch (err) {
      params.onError?.(getErrorMessage(err, 'Não deu para transcrever o áudio agora. Tenta de novo.'))
    } finally {
      setTranscribing(false)
    }
  }

  async function start(currentText: string) {
    if (recording || transcribing) return
    baseTextRef.current = currentText
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        if (cancelledRef.current) {
          cancelledRef.current = false
          return
        }
        void transcribe(new Blob(chunksRef.current, { type: recorder.mimeType }))
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS)
    } catch {
      params.onError?.('O navegador não tem permissão para usar o microfone.')
    }
  }

  function stop() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  /** Solta o microfone sem transcrever — Esc, ou desistir no meio da gravação. */
  function cancel() {
    if (recorderRef.current?.state !== 'recording') return
    cancelledRef.current = true
    stop()
  }

  function toggle(currentText: string) {
    if (recording) stop()
    else void start(currentText)
  }

  return { supported, recording, transcribing, toggle, stop, cancel }
}
