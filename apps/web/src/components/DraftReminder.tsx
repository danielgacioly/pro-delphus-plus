import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { clearDraft, DRAFT_PATHS, peekDraft, RESUME_DRAFT_PARAM, type DraftKind } from '../lib/formDraft'
import { IconChevronRight } from './icons'

const TITLES: Record<DraftKind, string> = {
  quote: 'Orçamento em andamento',
  order: 'Pedido em andamento',
}

/**
 * Aviso flutuante de rascunho em andamento — no mesmo vermelho claro do card
 * da Biblioteca na Home, para chamar atenção sem parecer erro. Aparece em
 * qualquer tela menos no próprio formulário; "Continuar" reabre o rascunho,
 * "Descartar" apaga. Entrar em "Novo" pelo menu também descarta (ver formDraft).
 */
export function DraftReminder() {
  const { user } = useAuth()
  const location = useLocation()
  // Força reler o armazenamento depois de descartar.
  const [, setDiscarded] = useState(0)

  const drafts = (Object.keys(DRAFT_PATHS) as DraftKind[])
    .filter((kind) => location.pathname !== DRAFT_PATHS[kind])
    .map((kind) => ({ kind, draft: peekDraft(kind, user?.id) }))
    .filter((entry) => entry.draft !== null)

  if (drafts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-[90] flex flex-col items-end gap-2 sm:left-auto sm:w-80">
      {drafts.map(({ kind, draft }) => (
        <div
          key={kind}
          role="status"
          className="animate-scale-in pointer-events-auto w-full rounded-2xl border border-brand-200 bg-brand-100 p-4 shadow-lg"
        >
          <div className="flex items-start gap-2.5">
            <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold tracking-[-0.01em] text-brand-900">{TITLES[kind]}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-brand-800">{draft?.label}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                clearDraft(kind, user?.id)
                setDiscarded((n) => n + 1)
              }}
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-brand-800 transition-colors hover:bg-brand-600/10"
            >
              Descartar
            </button>
            <Link
              to={`${DRAFT_PATHS[kind]}?${RESUME_DRAFT_PARAM}=1`}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-700"
            >
              Continuar
              <IconChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
