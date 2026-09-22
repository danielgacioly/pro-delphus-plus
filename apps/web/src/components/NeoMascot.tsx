import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import avatar from '../assets/neo-avatar.png'
import mascote from '../assets/neo-mascote.mp4'
import listening from '../assets/neo-listening.mp4'

/**
 * Retrato do NEO, já recortado no traço do rosto: a borda desenhada é a
 * própria borda do círculo, então não precisa de moldura por CSS.
 * Enquanto ele pensa, o avatar respira — é o sinal de "estou trabalhando".
 */
export function NeoAvatar({ thinking = false, className }: { thinking?: boolean; className?: string }) {
  return (
    <img
      src={avatar}
      alt="NEO"
      className={cn('shrink-0 rounded-full object-cover', thinking && 'animate-neo-breathe', className)}
    />
  )
}

/**
 * O vídeo é 16:9 com fundo branco e o NEO ocupando só a faixa central do
 * quadro. Num container quadrado o `object-cover` já descarta as laterais
 * (sobra o quadrado central do vídeo); o transform enquadra o corpo inteiro
 * dentro desse quadrado. Valores medidos no próprio arquivo.
 */
const FRAMING = 'scale(1.2) translate(-3.5%, -6.1%)'

/** Quadro em que o NEO está de frente e sorrindo — é como ele fica parado. */
const STILL_TIME = 2.4

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

interface NeoMascotProps {
  /** Anima enquanto true; parado (num quadro escolhido) quando false. */
  playing?: boolean
  className?: string
}

export function NeoMascot({ playing = true, className }: NeoMascotProps) {
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
        playsInline
        autoPlay={shouldPlay}
        preload="auto"
        aria-hidden
        // `multiply` some com o fundo branco do vídeo sobre qualquer superfície
        // clara — sem isso fica um retângulo branco no meio da tela.
        className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
        style={{ transform: FRAMING }}
      />
    </div>
  )
}

/**
 * O NEO com a mão na orelha, ouvindo — some do DOM quando `active` é false
 * (não só `display: none`) pra recomeçar do início a cada vez que o
 * microfone liga, em vez de continuar de onde parou.
 */
// O vídeo é 16:9 com barras pretas nas laterais (pillarbox) em volta do
// personagem; o object-cover já enquadra em pé, só falta esse zoom pra
// cortar as barras pra fora do quadrado.
const LISTENING_FRAMING = 'scale(1.18)'

export function NeoListening({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <video
        src={listening}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
        style={{ transform: LISTENING_FRAMING }}
      />
    </div>
  )
}
