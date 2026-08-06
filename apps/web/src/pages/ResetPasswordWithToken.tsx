import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthLayout, AuthNotice } from '../components/AuthLayout'
import { Button, Field, Input } from '../components/ui'

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
    <AuthLayout
      headline={
        <>
          Quase lá.
          <br />
          Escolha uma nova senha.
        </>
      }
      tagline="Depois disso, é só entrar normalmente."
      title="Redefinir senha"
      subtitle="Escolha uma senha com pelo menos 6 caracteres."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthNotice tone="error">{error}</AuthNotice>}

        {!token && <AuthNotice tone="error">Link inválido ou incompleto. Solicite uma nova recuperação.</AuthNotice>}

        <Field label="Nova senha">
          <Input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" disabled={submitting || !token} className="w-full">
          {submitting ? 'Salvando…' : 'Redefinir senha'}
        </Button>

        <p className="pt-1 text-center text-[13px] text-neutral-500">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
