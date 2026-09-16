import { useState } from 'react'
import { Modal } from './Modal'
import { Button, Input } from './ui'

interface ConfirmDeleteModalProps {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
  error?: string | null
}

const CONFIRM_WORD = 'excluir'

export function ConfirmDeleteModal({ title, description, onConfirm, onCancel, isPending, error }: ConfirmDeleteModalProps) {
  const [value, setValue] = useState('')
  const canConfirm = value.trim().toLowerCase() === CONFIRM_WORD

  return (
    <Modal onClose={onCancel}>
      <div className="animate-scale-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <p className="mt-3 text-sm text-neutral-600">
          Para confirmar, digite <strong className="text-danger-600">excluir</strong> abaixo:
        </p>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) onConfirm()
          }}
          className="mt-2"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={!canConfirm} isLoading={isPending}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  )
}
