import { useEffect, useRef } from 'react'
import { LAND_MASK_BASE64, LAND_MASK_HEIGHT, LAND_MASK_WIDTH } from '../assets/landMask'

export interface GlobeMarker {
  lat: number
  lng: number
  label?: string
}

interface GlobeProps {
  /** Pontos destacados na superfície — sede, distribuidores, clientes. */
  markers?: GlobeMarker[]
  /** Graus por segundo. */
  speed?: number
  /** Inclinação vertical: positivo mostra mais o hemisfério norte. */
  tilt?: number
  /** Longitude que fica no centro da face visível no primeiro quadro. */
  initialLongitude?: number
  /** Quantos pontos sorteados na esfera — só os que caem em terra viram dot. */
  density?: number
  dotColor?: string
  markerColor?: string
  className?: string
}

const DEG = Math.PI / 180

function decodeMask() {
  const binary = atob(LAND_MASK_BASE64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isLand(mask: Uint8Array, lat: number, lng: number) {
  const x = Math.min(LAND_MASK_WIDTH - 1, Math.max(0, Math.floor(((lng + 180) / 360) * LAND_MASK_WIDTH)))
  const y = Math.min(LAND_MASK_HEIGHT - 1, Math.max(0, Math.floor(((90 - lat) / 180) * LAND_MASK_HEIGHT)))
  const bit = y * LAND_MASK_WIDTH + x
  return (mask[bit >> 3] >> (7 - (bit & 7))) & 1
}

/**
 * Distribuição de Fibonacci: espalha os pontos uniformemente pela esfera, sem o
 * acúmulo nos polos que uma grade de lat/lng produziria.
 */
function landPoints(mask: Uint8Array, count: number) {
  const points: { sinLat: number; cosLat: number; lng: number }[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const z = 1 - (2 * i) / (count - 1)
    const lat = Math.asin(z) / DEG
    const lng = (((i * golden) / DEG) % 360) - 180
    if (!isLand(mask, lat, lng)) continue
    points.push({ sinLat: z, cosLat: Math.cos(lat * DEG), lng: lng * DEG })
  }
  return points
}

/**
 * Globo pontilhado em canvas, sem dependência externa.
 *
 * Projeção ortográfica: a esfera é vista de infinitamente longe, então o
 * hemisfério de trás simplesmente some (`cosC < 0`) em vez de ser espelhado. O
 * mesmo `cosC` serve de profundidade — pontos perto da borda ficam menores e
 * mais apagados, que é o que dá volume à silhueta.
 */
export function Globe({
  markers = [],
  speed = 6,
  tilt = 18,
  initialLongitude = -50,
  density = 34000,
  dotColor = '255, 255, 255',
  markerColor = '205, 43, 29',
  className,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Os marcadores são lidos por referência dentro do loop: se entrassem nas
  // dependências, um array declarado inline no JSX remontaria o globo — e a
  // varredura dos 34 mil pontos — a cada render do pai.
  const markersRef = useRef(markers)
  markersRef.current = markers

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const points = landPoints(decodeMask(), density)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let radius = 0
    let raf = 0
    let longitude = -initialLongitude * DEG
    let last = performance.now()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      radius = (Math.min(width, height) / 2) * 0.92
    }

    const sinTilt = Math.sin(tilt * DEG)
    const cosTilt = Math.cos(tilt * DEG)

    // Cinco faixas de profundidade: agrupar os pontos por opacidade permite um
    // fill por faixa em vez de um por ponto — a diferença é o que mantém o
    // quadro barato com milhares de dots.
    const BANDS = 5

    function draw(now: number) {
      const elapsed = (now - last) / 1000
      last = now

      // Abaixo de `lg` o painel inteiro é `display:none` e o canvas mede 0×0.
      // Sem esta saída o loop continuaria projetando milhares de pontos em cima
      // de nada — justamente nos aparelhos mais fracos.
      if (width === 0 || height === 0) {
        raf = requestAnimationFrame(draw)
        return
      }

      if (!still) longitude -= speed * DEG * elapsed

      ctx!.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2

      const paths: Path2D[] = []
      for (let i = 0; i < BANDS; i++) paths.push(new Path2D())

      for (const p of points) {
        // Rotação em torno do eixo polar, depois inclinação.
        const dLng = p.lng + longitude
        const x = p.cosLat * Math.sin(dLng)
        const yRaw = p.cosLat * Math.cos(dLng)
        const cosC = sinTilt * p.sinLat + cosTilt * yRaw
        if (cosC <= 0.02) continue
        const y = cosTilt * p.sinLat - sinTilt * yRaw

        const band = Math.min(BANDS - 1, Math.floor(cosC * BANDS))
        const r = 0.55 + cosC * 0.85
        const px = cx + x * radius
        const py = cy - y * radius
        paths[band].moveTo(px + r, py)
        paths[band].arc(px, py, r, 0, Math.PI * 2)
      }

      for (let i = 0; i < BANDS; i++) {
        ctx!.fillStyle = `rgba(${dotColor}, ${0.16 + (i / (BANDS - 1)) * 0.5})`
        ctx!.fill(paths[i])
      }

      // Halo sutil no limbo, para o globo não terminar num corte seco.
      ctx!.strokeStyle = `rgba(${dotColor}, 0.13)`
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx!.stroke()

      const pulse = still ? 0.5 : (Math.sin(now / 700) + 1) / 2
      for (const marker of markersRef.current) {
        const lat = marker.lat * DEG
        const dLng = marker.lng * DEG + longitude
        const sinLat = Math.sin(lat)
        const cosLat = Math.cos(lat)
        const yRaw = cosLat * Math.cos(dLng)
        const cosC = sinTilt * sinLat + cosTilt * yRaw
        if (cosC <= 0) continue
        const px = cx + cosLat * Math.sin(dLng) * radius
        const py = cy - (cosTilt * sinLat - sinTilt * yRaw) * radius
        const fade = Math.min(1, cosC * 2.2)

        ctx!.fillStyle = `rgba(${markerColor}, ${0.16 * fade * (1 - pulse)})`
        ctx!.beginPath()
        ctx!.arc(px, py, 4 + pulse * 12, 0, Math.PI * 2)
        ctx!.fill()

        ctx!.fillStyle = `rgba(${markerColor}, ${fade})`
        ctx!.beginPath()
        ctx!.arc(px, py, 2.8, 0, Math.PI * 2)
        ctx!.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    raf = requestAnimationFrame(draw)

    // Sem isso o rAF continua acumulando tempo com a aba escondida e o globo
    // "salta" ao voltar.
    const onVisibility = () => {
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [speed, tilt, initialLongitude, density, dotColor, markerColor])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}
