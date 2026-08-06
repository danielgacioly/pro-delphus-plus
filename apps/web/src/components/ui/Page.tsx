import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

/**
 * Observa a rolagem do contêiner rolável mais próximo.
 * Usado para o cabeçalho compacto aparecer só depois que o título grande sai de vista.
 */
function useScrolledPast(threshold = 28) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let parent: HTMLElement | null = el.parentElement
    while (parent) {
      const overflowY = getComputedStyle(parent).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') break
      parent = parent.parentElement
    }

    const target: HTMLElement | Window = parent ?? window
    const read = () => setScrolled((parent ? parent.scrollTop : window.scrollY) > threshold)

    read()
    target.addEventListener('scroll', read, { passive: true })
    return () => target.removeEventListener('scroll', read)
  }, [threshold])

  return { ref, scrolled }
}

/**
 * Casca padrão de todas as telas.
 *
 * Segue o padrão de “título grande” do iOS/macOS: o título nasce grande no corpo
 * da página e, ao rolar, migra para uma barra translúcida fixa no topo — que
 * também mantém as ações principais sempre ao alcance.
 */
export function Page({
  title,
  description,
  actions,
  children,
  width = 'wide',
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  width?: 'wide' | 'narrow' | 'full'
}) {
  const { ref, scrolled } = useScrolledPast()

  const container =
    width === 'narrow' ? 'mx-auto w-full max-w-3xl' : width === 'full' ? 'w-full' : 'mx-auto w-full max-w-[1440px]'

  return (
    <>
      <div ref={ref} aria-hidden className="h-0" />

      <header
        className={cn(
          'sticky top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-300 ease-out',
          scrolled ? 'material border-b border-neutral-200/70' : 'border-b border-transparent',
        )}
      >
        <div className={cn(container, 'flex h-14 items-center gap-4 px-6 sm:px-8')}>
          <h2
            className={cn(
              'min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-900',
              'transition-[opacity,transform] duration-300 ease-out',
              scrolled ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
            )}
          >
            {title}
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>

      <div className={cn(container, 'px-6 pb-20 sm:px-8')}>
        <div className="pt-1 pb-7">
          <h1 className="text-display text-ink-900">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-500">{description}</p>
          )}
        </div>
        {children}
      </div>
    </>
  )
}

/** Agrupamento de conteúdo dentro de uma página, com rótulo discreto. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      {(title || action) && (
        <div className="mb-3.5 flex items-end justify-between gap-4">
          {title && <h2 className="text-eyebrow text-neutral-400">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Link de volta para telas de formulário/detalhe. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-ink-900"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  )
}
