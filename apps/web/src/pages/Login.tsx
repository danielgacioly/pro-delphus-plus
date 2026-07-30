import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.svg'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'E-mail ou senha inválidos.'
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
            Simuladores cirúrgicos,
            <br />
            do orçamento à exportação.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Tabela de preços, catálogo de produtos e geração de documentos em um único lugar.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <img src={logo} alt="Pro Delphus" className="mb-8 h-12 w-auto lg:hidden" />
          <h1 className="mb-1 text-2xl font-bold text-ink-900">Bem-vindo de volta</h1>
          <p className="mb-8 text-sm text-neutral-500">Entre com sua conta do Pro Delphus+.</p>

          {error && (
            <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>
          )}

          <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-neutral-700">Senha</label>
            <Link to="/esqueci-senha" className="text-xs font-medium text-brand-600 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="mt-4 text-center text-sm text-neutral-500">
            Ainda não tem conta?{' '}
            <Link to="/cadastro" className="font-medium text-brand-600 hover:underline">
              Solicitar acesso
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
