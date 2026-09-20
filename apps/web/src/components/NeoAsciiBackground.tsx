import { useEffect, useRef } from 'react'
import { NeoFluidField } from '../lib/neoFluidField'

export function NeoAsciiBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.width = '105%'
    canvas.style.height = '105%'
    canvas.style.opacity = '0.32'
    container.append(canvas)
    const context = canvas.getContext('2d')
    if (!context) return () => canvas.remove()

    const characters = ' PRODELPHUS.:+-=x$#@'
    const brand =
      getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim() || '#c4483a'
    let field = new NeoFluidField(1)
    let columns = 80
    let rows = 40
    let animation = 0
    let disposed = false
    let last = performance.now()

    let bounds = container.getBoundingClientRect()

    const resize = () => {
      const rect = container.getBoundingClientRect()
      bounds = rect
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      field = new NeoFluidField(rect.width / Math.max(rect.height, 1))
      columns = field.gridColumns
      rows = field.gridRows
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const render = (now: number) => {
      if (disposed) return
      const seconds = Math.min(0.05, (now - last) / 1000)
      last = now
      field.step(seconds)
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const cellWidth = canvas.width / dpr / columns
      const cellHeight = canvas.height / dpr / rows
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      context.fillStyle = brand
      context.globalAlpha = 0.7
      context.font = `${Math.max(8, Math.min(11, cellHeight))}px ui-monospace, SFMono-Regular, Menlo, monospace`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const sample = field.sample(column % field.gridColumns, row % field.gridRows, (now / 1000) * 0.28)
          const density = 0.18 + sample.density * 0.82
          const index = Math.max(1, Math.min(characters.length - 1, Math.floor(density * characters.length)))
          const offsetX = sample.x * 12
          const offsetY = sample.y * 12
          context.fillText(characters[index], column * cellWidth + cellWidth / 2 + offsetX, row * cellHeight + cellHeight / 2 + offsetY)
        }
      }
      // Um quadro só para quem pede menos movimento: o desenho continua, a
      // animação não.
      if (!reducedMotion) animation = window.requestAnimationFrame(render)
    }

    const pointerMove = (event: PointerEvent) => {
      if (!bounds.width || !bounds.height) return
      const x = (event.clientX - bounds.left) / bounds.width
      const y = (event.clientY - bounds.top) / bounds.height
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        field.leave()
        return
      }
      field.move(x, y)
    }
    const pointerLeave = () => field.leave()
    const observer = new ResizeObserver(resize)
    // A rolagem move o container sem redimensioná-lo: o retângulo precisa ser
    // remedido, senão o ponteiro passa a empurrar o fluido no lugar errado.
    window.addEventListener('scroll', resize, { passive: true })
    resize()
    observer.observe(container)
    window.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerleave', pointerLeave)
    // Só um laço: render() já agenda o próximo quadro no fim de cada passada.
    animation = window.requestAnimationFrame(render)

    return () => {
      disposed = true
      window.cancelAnimationFrame(animation)
      observer.disconnect()
      window.removeEventListener('scroll', resize)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerleave', pointerLeave)
      canvas.remove()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    />
  )
}
