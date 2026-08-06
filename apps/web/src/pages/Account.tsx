import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { UserDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { DropZone } from '../components/DropZone'
import { BackLink, Button, Card, Field, Input, Page, SegmentedControl } from '../components/ui'

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-6">
      <h2 className="text-heading text-ink-900">{title}</h2>
      {description && <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      className={`animate-fade-in mb-4 rounded-xl px-4 py-3 text-[13px] ${
        tone === 'error' ? 'bg-brand-50 text-brand-700' : 'bg-emerald-500/12 text-emerald-800'
      }`}
    >
      {children}
    </div>
  )
}

export function Account() {
  const { user, setUser } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [signatureError, setSignatureError] = useState<string | null>(null)

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)
    setSavingProfile(true)
    try {
      const { data } = await api.patch<{ user: UserDTO }>('/auth/me', {
        name,
        email,
        phone: phone || null,
        jobTitle: jobTitle || null,
      })
      setUser(data.user)
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(errorMessage(err, 'Não foi possível salvar as alterações.'))
    } finally {
      setSavingProfile(false)
    }
  }

  const updateLanguage = useMutation({
    mutationFn: async (catalogLanguage: 'EN' | 'PT') => {
      const { data } = await api.patch<{ user: UserDTO }>('/auth/me', { catalogLanguage })
      return data.user
    },
    onSuccess: (user) => setUser(user),
  })

  const uploadSignature = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<{ user: UserDTO }>('/auth/me/signature', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.user
    },
    onSuccess: (user) => {
      setUser(user)
      setSignatureError(null)
    },
    onError: (err) => setSignatureError(errorMessage(err, 'Não foi possível enviar a assinatura.')),
  })

  const removeSignature = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ user: UserDTO }>('/auth/me/signature')
      return data.user
    },
    onSuccess: (user) => setUser(user),
  })

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSuccess(true)
    } catch (err) {
      setPasswordError(errorMessage(err, 'Não foi possível trocar a senha.'))
    } finally {
      setSavingPassword(false)
    }
  }

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <Page title="Minha Conta" description={user?.email} width="narrow">
      <div className="-mt-4 mb-6">
        <BackLink to="/">Início</BackLink>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[20px] font-semibold text-white shadow-sm">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-ink-900">{user?.name}</p>
          <p className="truncate text-[13px] text-neutral-500">{user?.jobTitle || 'Sem cargo definido'}</p>
        </div>
      </div>

      <div className="space-y-4">
        <SettingsCard title="Dados pessoais">
          <form onSubmit={handleProfileSubmit}>
            {profileError && <Notice tone="error">{profileError}</Notice>}
            {profileSuccess && <Notice tone="success">Dados atualizados.</Notice>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="E-mail">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Cargo">
                <Input
                  placeholder="ex: Vendedor(a)"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </Field>
              <Field label="Telefone">
                <Input placeholder="+55 (81) 90000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="primary" disabled={savingProfile}>
                {savingProfile ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </SettingsCard>

        <SettingsCard
          title="Idioma do catálogo"
          description="Em que idioma descrições, componentes e nomes de setores aparecem na Tabela de Preços e em Produtos."
        >
          <SegmentedControl
            aria-label="Idioma do catálogo"
            value={user?.catalogLanguage ?? 'EN'}
            onChange={(value) => updateLanguage.mutate(value)}
            options={[
              { value: 'EN', label: 'English' },
              { value: 'PT', label: 'Português' },
            ]}
          />
        </SettingsCard>

        <SettingsCard
          title="Assinatura"
          description="Envie uma imagem da sua assinatura para ela aparecer nos orçamentos que você gerar."
        >
          {signatureError && <Notice tone="error">{signatureError}</Notice>}

          {user?.signatureUrl ? (
            <div className="mb-4 flex items-center gap-4">
              <img
                src={user.signatureUrl}
                alt="Sua assinatura"
                className="h-16 max-w-[220px] rounded-xl border border-neutral-200/70 bg-neutral-50 object-contain p-2"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeSignature.mutate()}
                disabled={removeSignature.isPending}
                className="hover:bg-brand-50 hover:text-brand-600"
              >
                Remover
              </Button>
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-neutral-400">Nenhuma assinatura enviada ainda.</p>
          )}

          <DropZone
            accept="image/*"
            disabled={uploadSignature.isPending}
            onFiles={(files) => {
              const file = files[0]
              if (file) uploadSignature.mutate(file)
            }}
          >
            <p className="text-[12.5px] text-neutral-500">
              Arraste uma imagem ou <span className="font-medium text-brand-600">clique para selecionar</span>
            </p>
          </DropZone>
          {uploadSignature.isPending && <p className="mt-2 text-[12px] text-neutral-400">Enviando…</p>}
        </SettingsCard>

        <SettingsCard title="Trocar senha">
          <form onSubmit={handlePasswordSubmit}>
            {passwordError && <Notice tone="error">{passwordError}</Notice>}
            {passwordSuccess && <Notice tone="success">Senha alterada.</Notice>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Senha atual">
                <Input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </Field>
              <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="primary" disabled={savingPassword}>
                {savingPassword ? 'Salvando…' : 'Trocar senha'}
              </Button>
            </div>
          </form>
        </SettingsCard>
      </div>
    </Page>
  )
}
