import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthLayout, AuthNotice } from '../components/AuthLayout'
import { Button, ButtonLink, Field, Input } from '../components/ui'

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
      await api.post('/auth/register', {
        name,
        email,
        password,
        phone: phone || undefined,
        jobTitle: jobTitle || undefined,
      })
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

  return (
    <AuthLayout
      headline={
        <>
          Peça acesso,
          <br />
          comece a trabalhar em minutos.
        </>
      }
      tagline="Um administrador aprova seu cadastro e você já tem tabela de preços, catálogo e orçamentos na mão."
      title={done ? 'Conta criada' : 'Criar conta'}
      subtitle={
        done
          ? 'Seu cadastro está aguardando aprovação.'
          : 'Solicite acesso ao Pro Delphus+. Um administrador precisa aprovar seu cadastro.'
      }
    >
      {done ? (
        <div className="space-y-5">
          <AuthNotice tone="success">
            Seu cadastro foi enviado e está aguardando aprovação de um administrador. Você vai conseguir entrar assim
            que ele liberar seu acesso.
          </AuthNotice>
          <ButtonLink to="/login" variant="primary" size="lg" className="w-full">
            Voltar para o login
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <AuthNotice tone="error">{error}</AuthNotice>}

          <Field label="Nome completo">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="E-mail">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>

          <Field label="Senha" hint="Mínimo de 6 caracteres.">
            <Input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field label="Cargo (opcional)">
            <Input placeholder="ex: Vendedor(a)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>

          <Field label="Telefone (opcional)">
            <Input placeholder="+55 (81) 90000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
            {submitting ? 'Enviando…' : 'Solicitar acesso'}
          </Button>

          <p className="pt-1 text-center text-[13px] text-neutral-500">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
