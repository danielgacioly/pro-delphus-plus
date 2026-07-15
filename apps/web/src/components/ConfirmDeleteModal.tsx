import { useState } from 'react'

interface ConfirmDeleteModalProps {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

const CONFIRM_WORD = 'excluir'

export function ConfirmDeleteModal({ title, description, onConfirm, onCancel, isPending }: ConfirmDeleteModalProps) {
  const [value, setValue] = useState('')
  const canConfirm = value.trim().toLowerCase() === CONFIRM_WORD

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
        <p className="mt-3 text-sm text-neutral-600">
          Para confirmar, digite <strong className="text-brand-600">excluir</strong> abaixo:
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) onConfirm()
          }}
          className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || isPending}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {isPending ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
