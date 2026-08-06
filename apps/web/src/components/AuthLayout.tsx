import type { ReactNode } from 'react'
import logo from '../assets/logo.svg'

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
}: {
  headline: ReactNode
  tagline: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[44%] shrink-0 overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-brand-600/12 blur-3xl" />

        <div className="relative">
          <div className="h-1 w-10 rounded-full bg-brand-500" />
          <p className="text-eyebrow mt-4 text-white/50">Pro Delphus+</p>
        </div>

        <div className="relative">
          <h1 className="text-[34px] font-bold leading-[1.14] tracking-[-0.022em] text-white">{headline}</h1>
          <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-white/60">{tagline}</p>
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
