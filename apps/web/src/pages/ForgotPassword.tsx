import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthLayout, AuthNotice } from '../components/AuthLayout'
import { Button, ButtonLink, Field, Input } from '../components/ui'

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
    <AuthLayout
      headline={
        <>
          Acontece com todo mundo.
          <br />
          Vamos te ajudar a voltar.
        </>
      }
      tagline="Enviamos um link seguro para redefinir sua senha em poucos minutos."
      title="Esqueci minha senha"
      subtitle={
        sent
          ? 'Se a conta existir, o link já está a caminho.'
          : 'Informe o e-mail da conta e para onde devemos enviar o link.'
      }
    >
      {sent ? (
        <div className="space-y-5">
          <AuthNotice tone="success">
            Se a conta existir, enviamos um e-mail com um link para redefinir a senha. Pode levar alguns minutos para
            chegar.
          </AuthNotice>
          <ButtonLink to="/login" variant="primary" size="lg" className="w-full">
            Voltar para o login
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <AuthNotice tone="error">{error}</AuthNotice>}

          <Field label="E-mail da conta">
            <Input type="email" required value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} />
          </Field>

          <Field label="Enviar recuperação para">
            <Input type="email" required value={deliveryEmail} onChange={(e) => setDeliveryEmail(e.target.value)} />
          </Field>

          <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
            {submitting ? 'Enviando…' : 'Enviar link de recuperação'}
          </Button>

          <p className="pt-1 text-center text-[13px] text-neutral-500">
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
