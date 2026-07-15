import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import logo from '../assets/logo.svg'

export function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/auth/register', { name, email, password, phone: phone || undefined, jobTitle: jobTitle || undefined })
      setDone(true)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível criar a conta.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <img src={logo} alt="Pro Delphus" className="mx-auto mb-4 h-14 w-auto" />
          <h1 className="text-lg font-bold text-ink-900">Conta criada!</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Seu cadastro foi enviado e está aguardando aprovação de um administrador. Você vai
            conseguir entrar assim que ele liberar seu acesso.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <img src={logo} alt="Pro Delphus" className="mb-4 h-12 w-auto" />
        <h1 className="mb-1 text-xl font-bold text-ink-900">Criar conta</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Solicite acesso ao Pro Delphus+. Um administrador precisa aprovar seu cadastro.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Nome completo</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Senha</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Cargo</label>
        <input
          placeholder="ex: Vendedor(a)"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Telefone</label>
        <input
          placeholder="+55 (81) 90000-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-6 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Enviando…' : 'Solicitar acesso'}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-500">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  )
}
