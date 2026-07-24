import { useState } from 'react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 className="text-base font-semibold text-ink-900">Redefinir senha de {userName}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Defina uma senha temporária. A pessoa poderá trocá-la depois em "Minha Conta".
        </p>
        <input
          autoFocus
          type="password"
          placeholder="Nova senha (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) submit()
          }}
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-brand-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canConfirm || isPending}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {isPending ? 'Redefinindo…' : 'Redefinir senha'}
          </button>
        </div>
      </div>
    </div>
  )
}
