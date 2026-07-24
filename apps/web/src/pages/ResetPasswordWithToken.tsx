import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import logo from '../assets/logo.svg'

export function ResetPasswordWithToken() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword })
      navigate('/login')
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível redefinir a senha. Solicite um novo link.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-red-600 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <img src={logo} alt="Pro Delphus" className="mb-5 h-14 w-auto" />
        <h1 className="mb-1 text-xl font-bold text-ink-900">Escolher nova senha</h1>
        <p className="mb-6 text-sm text-neutral-500">Defina a nova senha da sua conta.</p>

        {!token && (
          <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Link inválido — falta o token de redefinição. Solicite um novo link.
          </div>
        )}
        {error && <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Nova senha</label>
        <input
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <button
          type="submit"
          disabled={submitting || !token}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Salvando…' : 'Redefinir senha'}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-500">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </div>
  )
}
