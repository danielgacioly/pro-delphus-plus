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
    <div className="flex min-h-screen items-center justify-center bg-red-600 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <img src={logo} alt="Pro Delphus" className="mb-5 h-14 w-auto" />
        <h1 className="mb-1 text-xl font-bold text-ink-900">Bem-vindo de volta</h1>
        <p className="mb-6 text-sm text-neutral-500">Entre com sua conta do Pro Delphus+.</p>

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
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
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
  )
}
