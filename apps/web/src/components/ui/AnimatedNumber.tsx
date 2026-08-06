import { useEffect, useRef, useState } from 'react'

/**
 * Conta de zero até `value` quando o número aparece ou muda.
 *
 * A curva é um ease-out cúbico: sobe rápido e desacelera no fim, que é o que faz
 * o número parecer "assentar" em vez de parar seco. Com `prefers-reduced-motion`
 * o valor final é pintado direto, sem animação.
 */
function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  // Os cartões só montam depois que a query resolve, então na primeira vez o
  // valor já chega pronto. Sem partir explicitamente de zero, o delta seria
  // zero e a contagem nunca aconteceria.
  const mountedRef = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      fromRef.current = value
      mountedRef.current = true
      return
    }

    const from = mountedRef.current ? fromRef.current : 0
    mountedRef.current = true
    const delta = value - from
    if (delta === 0) {
      setDisplay(value)
      fromRef.current = value
      return
    }

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + delta * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return display
}

export function AnimatedNumber({
  value,
  format,
  duration,
}: {
  value: number
  /** Formatação aplicada a cada quadro — sem ela o número sai cru. */
  format?: (value: number) => string
  duration?: number
}) {
  const current = useCountUp(value, duration)
  return <>{format ? format(current) : Math.round(current).toLocaleString('pt-BR')}</>
}
