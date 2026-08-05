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
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-brand-600/10 blur-3xl" />

        <div className="relative">
          <div className="h-1 w-10 rounded-full bg-brand-500" />
          <p className="mt-4 text-sm font-medium uppercase tracking-wider text-white/50">Pro Delphus+</p>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Acontece com todo mundo.
            <br />
            Vamos te ajudar a voltar.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Enviamos um link seguro para redefinir sua senha em poucos minutos.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          <img src={logo} alt="Pro Delphus" className="mb-8 h-12 w-auto lg:hidden" />
          <h1 className="mb-1 text-2xl font-bold text-ink-900">Esqueci minha senha</h1>

          {sent ? (
            <>
              <p className="mb-8 text-sm text-neutral-500">
                Se a conta existir, enviamos um e-mail com um link para redefinir a senha. Pode levar alguns
                minutos para chegar.
              </p>
              <Link
                to="/login"
                className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.99]"
              >
                Voltar para o login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="mb-8 text-sm text-neutral-500">
                Informe o e-mail da conta e para qual e-mail devemos enviar o link de redefinição.
              </p>

              {error && (
                <div className="animate-fade-in-up mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                  {error}
                </div>
              )}

              <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail da conta</label>
              <input
                type="email"
                required
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />

              <label className="mb-1 block text-sm font-medium text-neutral-700">Enviar recuperação para</label>
              <input
                type="email"
                required
                value={deliveryEmail}
                onChange={(e) => setDeliveryEmail(e.target.value)}
                className="mb-6 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
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
    </div>
  )
}
