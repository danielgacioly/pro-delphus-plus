import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MIN_PASSWORD_LENGTH, type UserDTO } from '@prodelphusplus/shared'
import { api, getErrorMessage as errorMessage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { DropZone } from '../components/DropZone'
import { Alert, Button, buttonClasses, Card, Field, FormSection, Input, Page, SegmentedControl } from '../components/ui'
import { IconDownload } from '../components/icons'

export function Account() {
  const { user, setUser } = useAuth()
  const toast = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [signatureError, setSignatureError] = useState<string | null>(null)

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError(null)
    setSavingProfile(true)
    try {
      const { data } = await api.patch<{ user: UserDTO }>('/auth/me', {
        name,
        email,
        phone: phone || null,
        whatsapp: whatsapp || null,
        jobTitle: jobTitle || null,
      })
      setUser(data.user)
      toast.success('Dados atualizados.')
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
    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Senha alterada.')
    } catch (err) {
      setPasswordError(errorMessage(err, 'Não foi possível trocar a senha.'))
    } finally {
      setSavingPassword(false)
    }
  }

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <Page
      back={{ to: '/', label: 'Início' }}
      title="Minha Conta"
      description="Seus dados, o idioma do catálogo, a assinatura dos orçamentos e a senha."
    >
      {/* Duas colunas a partir de xl, como em Novo orçamento/Novo pedido: o que
          se edita à esquerda, o que identifica e configura a conta à direita. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-6">
          <FormSection title="Dados pessoais">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileError && <Alert tone="error">{profileError}</Alert>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nome">
                  <Input required value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="E-mail">
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Cargo">
                  <Input placeholder="ex: Vendedor(a)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </Field>
                <Field label="Telefone fixo">
                  <Input placeholder="+55 (81) 3432.7702" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="WhatsApp">
                  <Input placeholder="+55 (81) 90000-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                </Field>
                <div className="flex items-end sm:justify-end lg:col-start-3">
                  <Button type="submit" variant="primary" size="lg" disabled={savingProfile} className="w-full sm:w-auto">
                    {savingProfile ? 'Salvando…' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>
            </form>
          </FormSection>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[18px] font-semibold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink-900">{user?.name}</p>
              <p className="truncate text-[13px] text-neutral-600">{user?.jobTitle || 'Sem cargo definido'}</p>
              <p className="truncate text-[12px] text-neutral-500">{user?.email}</p>
            </div>
          </div>

          <FormSection
            title="Idioma do catálogo"
            description="Idioma de descrições, componentes e setores na Tabela de Preços e em Produtos."
            className="mt-5"
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
          </FormSection>
        </Card>

        <Card className="p-6">
          <FormSection title="Trocar senha">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordError && <Alert tone="error">{passwordError}</Alert>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Senha atual">
                  <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </Field>
                <Field label="Nova senha" hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}>
                  <Input
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <div className="flex items-start sm:col-span-2 sm:justify-end lg:col-span-1 lg:pt-[26px]">
                  <Button type="submit" variant="primary" size="lg" disabled={savingPassword} className="w-full sm:w-auto">
                    {savingPassword ? 'Salvando…' : 'Trocar senha'}
                  </Button>
                </div>
              </div>
            </form>
          </FormSection>
        </Card>

        <Card className="p-5">
          <FormSection
            title="Assinatura"
            description="Uma imagem da sua assinatura, que sai nos orçamentos que você gerar."
          >
            {signatureError && (
              <div className="mb-3">
                <Alert tone="error">{signatureError}</Alert>
              </div>
            )}

            {user?.signatureUrl && (
              <div className="mb-3 flex items-center gap-2">
                <img
                  src={user.signatureUrl}
                  alt="Sua assinatura"
                  className="h-14 min-w-0 flex-1 rounded-xl border border-neutral-200/70 bg-neutral-50 object-contain p-2"
                />
                <a href={user.signatureUrl} download className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'px-2' })} title="Baixar">
                  <IconDownload className="h-3.5 w-3.5" />
                </a>
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
            )}

            <DropZone
              accept="image/*"
              className="py-3"
              disabled={uploadSignature.isPending}
              onFiles={(files) => {
                const file = files[0]
                if (file) uploadSignature.mutate(file)
              }}
            >
              <p className="text-[12.5px] text-neutral-600">
                {uploadSignature.isPending ? (
                  'Enviando…'
                ) : (
                  <>
                    Arraste uma imagem ou <span className="font-medium text-brand-600">clique para selecionar</span>
                  </>
                )}
              </p>
            </DropZone>
          </FormSection>
        </Card>
      </div>
    </Page>
  )
}
