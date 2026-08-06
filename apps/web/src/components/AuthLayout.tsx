import type { ReactNode } from 'react'
import logo from '../assets/logo.svg'
import { Globe, type GlobeMarker } from './Globe'

/**
 * Único marcador é a sede, em Olinda/PE. Os destinos ficam de fora de propósito:
 * o alcance está no texto, e sair inventando pontos no mapa seria inventar
 * cliente. Quando o cadastro de clientes tiver país preenchido, dá para trocar
 * essa lista pelos países que de fato compraram.
 */
const MARKERS: GlobeMarker[] = [{ lat: -8.01, lng: -34.86, label: 'Olinda, PE' }]

/**
 * Casca das telas de autenticação: painel escuro de marca à esquerda,
 * formulário centrado à direita. Abaixo de `lg` o painel some e sobra só o
 * formulário, com o logo no topo.
 */
export function AuthLayout({
  headline,
  tagline,
  title,
  subtitle,
  children,
  footnote,
}: {
  headline: ReactNode
  tagline: string
  title: string
  subtitle: string
  children: ReactNode
  /** Linha discreta no rodapé do painel escuro, abaixo do globo. */
  footnote?: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[44%] shrink-0 overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-16">
        {/* Esfera inteira visível na metade de cima do painel: é a curvatura que
            comunica "mundo", não a textura de pontos. O texto ocupa a metade de
            baixo, atrás do gradiente. */}
        <div className="pointer-events-none absolute -top-[7%] left-[6%] aspect-square w-[88%]">
          <Globe markers={MARKERS} initialLongitude={-50} className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-brand-600/12 blur-3xl" />
        {/* Escurece as duas pontas: em cima para o eyebrow ficar legível sobre os
            dots, embaixo para a headline não competir com o globo. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink-900 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-900 via-ink-900/90 to-transparent" />

        <div className="relative">
          <div className="h-1 w-10 rounded-full bg-brand-500" />
          <p className="text-eyebrow mt-4 text-white/50">Pro Delphus+</p>
        </div>

        <div className="relative">
          <h1 className="text-[34px] font-bold leading-[1.14] tracking-[-0.022em] text-white">{headline}</h1>
          <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-white/60">{tagline}</p>
          {footnote && (
            <div className="mt-7 flex items-center gap-2.5 border-t border-white/10 pt-5 text-[13px] text-white/45">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              {footnote}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <img src={logo} alt="Pro Delphus" className="mb-8 h-12 w-auto lg:hidden" />
          <h2 className="text-title text-ink-900">{title}</h2>
          <p className="mt-1.5 mb-7 text-[14px] text-neutral-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export function AuthNotice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      className={`animate-fade-in mb-5 rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
        tone === 'error' ? 'bg-brand-50 text-brand-700' : 'bg-emerald-500/12 text-emerald-800'
      }`}
    >
      {children}
    </div>
  )
}
