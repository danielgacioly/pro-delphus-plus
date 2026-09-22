import { useEffect, useRef, useState } from 'react'

// A DOM lib do TypeScript ainda não inclui a Web Speech API (é WICG, não
// padrão W3C) — só o suficiente do contrato pra cobrir o que usamos aqui.
interface SpeechRecognitionResultLike {
  transcript: string
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'O navegador não tem permissão para usar o microfone.',
  'service-not-allowed': 'O navegador não tem permissão para usar o microfone.',
  network: 'Erro de rede no reconhecimento de voz. Tenta de novo.',
}

/**
 * Ditado por voz via Web Speech API do navegador — sem backend, sem gastar
 * cota do Gemini. Só existe em Chrome, Edge e Safari (o Firefox não
 * implementa); quando falta, `supported` vem false e quem chama esconde o
 * botão. Exige contexto seguro (HTTPS ou localhost), senão o navegador nem
 * expõe a API.
 */
export function useSpeechToText(params: { onTranscript: (text: string) => void; onError?: (message: string) => void }) {
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // O texto que já estava no campo antes de apertar o microfone — o
  // reconhecimento devolve a fala inteira da sessão a cada evento, não só o
  // trecho novo, então é isso que entra na frente pra não perder o que a
  // pessoa já tinha digitado.
  const baseTextRef = useRef('')

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  function start(currentText: string) {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor || listening) return
    baseTextRef.current = currentText

    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]![0]!.transcript
      }
      const base = baseTextRef.current
      const separator = base && !base.endsWith(' ') ? ' ' : ''
      params.onTranscript(base + separator + transcript)
    }
    recognition.onerror = (event) => {
      setListening(false)
      const message = ERROR_MESSAGES[event.error]
      if (message) params.onError?.(message)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function stop() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function toggle(currentText: string) {
    if (listening) stop()
    else start(currentText)
  }

  return { supported, listening, toggle, stop }
}
