import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import mascote from '../assets/neo-mascote.mp4'

/**
 * O arquivo é 16:9 com fundo branco e o Neo ocupando só a faixa central do
 * quadro. Num container quadrado o `object-cover` já descarta as laterais
 * (sobra o quadrado central do vídeo); o transform abaixo enquadra o que
 * interessa dentro desse quadrado — a cabeça, para o avatar pequeno, ou o
 * corpo inteiro, para a saudação. Valores medidos no próprio arquivo.
 */
const FRAMING = {
  head: 'scale(1.95) translate(-3.5%, 16%)',
  full: 'scale(1.2) translate(-3.5%, -6.1%)',
} as const

/** Quadro em que o Neo está de frente e sorrindo — é como ele fica parado. */
const STILL_TIME = 2.4

interface NeoMascotProps {
  variant?: keyof typeof FRAMING
  /** Anima enquanto true; parado (primeiro quadro) quando false. */
  playing?: boolean
  className?: string
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function NeoMascot({ variant = 'head', playing = true, className }: NeoMascotProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const shouldPlay = playing && !reducedMotion

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Alguns navegadores recusam autoplay mesmo mudo. Aí vale o quadro parado,
    // e a animação começa no primeiro toque/tecla da pessoa na página.
    let retryOnGesture: (() => void) | null = null
    const armGestureRetry = () => {
      if (retryOnGesture) return
      retryOnGesture = () => {
        void video.play().catch(() => {})
      }
      document.addEventListener('pointerdown', retryOnGesture, { once: true })
      document.addEventListener('keydown', retryOnGesture, { once: true })
    }

    const apply = () => {
      if (shouldPlay) {
        void video.play().catch(() => {
          if (Math.abs(video.currentTime - STILL_TIME) > 0.05) video.currentTime = STILL_TIME
          armGestureRetry()
        })
      } else {
        video.pause()
        // O seek também força o decode: sem ele um vídeo que nunca tocou fica
        // como um retângulo vazio.
        if (Math.abs(video.currentTime - STILL_TIME) > 0.05) video.currentTime = STILL_TIME
      }
    }
    apply()
    // Metadata/dados podem chegar depois da montagem — aí o apply de cima não
    // teve efeito nenhum e precisa ser refeito.
    video.addEventListener('loadeddata', apply)
    return () => {
      video.removeEventListener('loadeddata', apply)
      if (retryOnGesture) {
        document.removeEventListener('pointerdown', retryOnGesture)
        document.removeEventListener('keydown', retryOnGesture)
      }
    }
  }, [shouldPlay])

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <video
        ref={videoRef}
        src={mascote}
        muted
        loop
        autoPlay={shouldPlay}
        playsInline
        preload="auto"
        aria-hidden
        // `multiply` some com o fundo branco do vídeo sobre qualquer superfície
        // clara — sem isso fica um quadrado branco no meio do cabeçalho.
        className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
        style={{ transform: FRAMING[variant] }}
      />
    </div>
  )
}
