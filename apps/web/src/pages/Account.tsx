import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { UserDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { DropZone } from '../components/DropZone'

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
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

  const [signatureError, setSignatureError] = useState<string | null>(null)

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
    <div className="max-w-2xl">
      <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar para o início
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
          {initial}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Minha Conta</h1>
          <p className="text-sm text-neutral-500">{user?.email}</p>
        </div>
      </div>

      <form onSubmit={handleProfileSubmit} className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Dados pessoais</h3>

        {profileError && (
          <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{profileError}</div>
        )}
        {profileSuccess && (
          <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Dados atualizados!</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Nome</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Cargo</label>
            <input
              placeholder="ex: Vendedor(a)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Telefone</label>
            <input
              placeholder="+55 (81) 90000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {savingProfile ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Idioma do catálogo</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Escolha em que idioma descrições, componentes e nomes de setores aparecem na Tabela de Preços e em
          Produtos. Por padrão, tudo aparece em inglês, como já é hoje.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateLanguage.mutate('EN')}
            disabled={updateLanguage.isPending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              (user?.catalogLanguage ?? 'EN') === 'EN'
                ? 'bg-ink-900 text-white'
                : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => updateLanguage.mutate('PT')}
            disabled={updateLanguage.isPending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              user?.catalogLanguage === 'PT'
                ? 'bg-ink-900 text-white'
                : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            Português
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Assinatura</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Envie uma imagem da sua assinatura para ela aparecer nos orçamentos que você gerar.
        </p>

        {signatureError && (
          <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{signatureError}</div>
        )}

        {user?.signatureUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={user.signatureUrl}
              alt="Sua assinatura"
              className="h-16 max-w-[13.75px] rounded-lg border border-neutral-200 bg-neutral-50 object-contain p-2"
            />
            <button
              onClick={() => removeSignature.mutate()}
              disabled={removeSignature.isPending}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Remover assinatura
            </button>
          </div>
        ) : (
          <p className="mb-2 text-xs text-neutral-400">Nenhuma assinatura enviada ainda.</p>
        )}

        <DropZone
          accept="image/*"
          disabled={uploadSignature.isPending}
          className="mt-3"
          onFiles={(files) => {
            const file = files[0]
            if (file) uploadSignature.mutate(file)
          }}
        >
          <p className="text-xs text-neutral-500">
            Arraste uma imagem aqui ou <span className="font-medium text-brand-600">clique para selecionar</span>
          </p>
        </DropZone>
        {uploadSignature.isPending && <p className="mt-1 text-xs text-neutral-400">Enviando…</p>}
      </div>

      <form onSubmit={handlePasswordSubmit} className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Trocar senha</h3>

        {passwordError && (
          <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{passwordError}</div>
        )}
        {passwordSuccess && (
          <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Senha alterada!</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Senha atual</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Nova senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingPassword}
          className="mt-4 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {savingPassword ? 'Salvando…' : 'Trocar senha'}
        </button>
      </form>
    </div>
  )
}
