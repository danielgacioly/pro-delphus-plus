import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  children: ReactNode
  /** Chamado ao apertar Escape e, se dismissOnBackdrop, ao clicar fora. */
  onClose?: () => void
  dismissOnBackdrop?: boolean
}

/**
 * Renderiza o modal via portal no <body>.
 *
 * Isso é essencial: qualquer ancestral com `transform` (por exemplo a animação de
 * transição de página no Layout) vira o bloco de contenção de filhos `position: fixed`,
 * fazendo o overlay cobrir só a área de conteúdo em vez da tela inteira.
 */
export function Modal({ children, onClose, dismissOnBackdrop }: ModalProps) {
  useEffect(() => {
    if (!onClose) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div
      // Só o clique no próprio fundo fecha — clique dentro do conteúdo
      // (campo, botão) também sobe até aqui e fecharia o modal no meio do uso.
      onClick={dismissOnBackdrop ? (e) => e.target === e.currentTarget && onClose?.() : undefined}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
    >
      {children}
    </div>,
    document.body,
  )
}
