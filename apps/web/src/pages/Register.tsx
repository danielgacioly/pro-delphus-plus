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

  const inputClass =
    'mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

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
            Peça acesso,
            <br />
            comece a trabalhar em minutos.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Um administrador aprova seu cadastro e você já tem tabela de preços, catálogo e orçamentos na mão.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {done ? (
          <div className="w-full max-w-sm animate-fade-in-up text-center">
            <img src={logo} alt="Pro Delphus" className="mx-auto mb-4 h-14 w-auto lg:hidden" />
            <h1 className="text-xl font-bold text-ink-900">Conta criada!</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Seu cadastro foi enviado e está aguardando aprovação de um administrador. Você vai conseguir entrar
              assim que ele liberar seu acesso.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-black active:scale-[0.98]"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-sm animate-fade-in-up">
            <img src={logo} alt="Pro Delphus" className="mb-8 h-12 w-auto lg:hidden" />
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Criar conta</h1>
            <p className="mb-6 text-sm text-neutral-500">
              Solicite acesso ao Pro Delphus+. Um administrador precisa aprovar seu cadastro.
            </p>

            {error && (
              <div className="animate-fade-in-up mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                {error}
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-neutral-700">Nome completo</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />

            <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />

            <label className="mb-1 block text-sm font-medium text-neutral-700">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />

            <label className="mb-1 block text-sm font-medium text-neutral-700">Cargo</label>
            <input
              placeholder="ex: Vendedor(a)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={inputClass}
            />

            <label className="mb-1 block text-sm font-medium text-neutral-700">Telefone</label>
            <input
              placeholder="+55 (81) 90000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`mb-6 ${inputClass.replace('mb-4 ', '')}`}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
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
        )}
      </div>
    </div>
  )
}
