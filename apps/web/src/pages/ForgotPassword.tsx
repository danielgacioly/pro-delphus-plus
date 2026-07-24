import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import logo from '../assets/logo.svg'

export function ForgotPassword() {
  const [accountEmail, setAccountEmail] = useState('')
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/auth/forgot-password', { accountEmail, deliveryEmail })
      setSent(true)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível enviar a recuperação. Tente novamente.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-red-600 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <img src={logo} alt="Pro Delphus" className="mb-5 h-14 w-auto" />
        <h1 className="mb-1 text-xl font-bold text-ink-900">Esqueci minha senha</h1>

        {sent ? (
          <>
            <p className="mb-6 text-sm text-neutral-500">
              Se a conta existir, enviamos um e-mail com um link para redefinir a senha. Pode levar alguns minutos
              para chegar.
            </p>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-6 text-sm text-neutral-500">
              Informe o e-mail da conta e para qual e-mail devemos enviar o link de redefinição.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>
            )}

            <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail da conta</label>
            <input
              type="email"
              required
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <label className="mb-1 block text-sm font-medium text-neutral-700">Enviar recuperação para</label>
            <input
              type="email"
              required
              value={deliveryEmail}
              onChange={(e) => setDeliveryEmail(e.target.value)}
              className="mb-6 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>

            <p className="mt-4 text-center text-sm text-neutral-500">
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                Voltar para o login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
