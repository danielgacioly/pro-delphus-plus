import { useState } from 'react'
import { Modal } from './Modal'
import { Button, Input } from './ui'

interface ResetPasswordModalProps {
  userName: string
  onConfirm: (password: string) => void
  onCancel: () => void
  isPending?: boolean
  error?: string | null
}

export function ResetPasswordModal({ userName, onConfirm, onCancel, isPending, error }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const canConfirm = password.length >= 6

  function submit() {
    if (canConfirm) onConfirm(password)
  }

  return (
    <Modal onClose={onCancel}>
      <div className="animate-scale-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-heading text-ink-900">Redefinir senha de {userName}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
          Defina uma senha temporária. A pessoa poderá trocá-la depois em "Minha Conta".
        </p>
        <Input
          autoFocus
          type="password"
          placeholder="Nova senha (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) submit()
          }}
          className="mt-3"
        />
        {error && <p className="mt-2 text-[13px] text-danger-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canConfirm} isLoading={isPending}>
            {isPending ? 'Redefinindo…' : 'Redefinir senha'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
