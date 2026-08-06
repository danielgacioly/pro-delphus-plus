import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthLayout, AuthNotice } from '../components/AuthLayout'
import { Button, Field, Input } from '../components/ui'

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
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'E-mail ou senha inválidos.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      headline={
        <>
          Simuladores cirúrgicos,
          <br />
          do orçamento à exportação.
        </>
      }
      tagline="Tabela de preços, catálogo de produtos e geração de documentos em um único lugar."
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta do Pro Delphus+."
      footnote={
        <span>
          De Olinda para <strong className="font-semibold text-white/75">68 países</strong>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthNotice tone="error">{error}</AuthNotice>}

        <Field label="E-mail">
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className="text-[13px] font-medium text-neutral-700">
              Senha
            </label>
            <Link to="/esqueci-senha" className="text-[12px] font-medium text-brand-600 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="pt-1 text-center text-[13px] text-neutral-500">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-brand-600 hover:underline">
            Solicitar acesso
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
