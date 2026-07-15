import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { UserDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

export function Profile() {
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink-900">Minha Conta</h1>
      <p className="mt-1 text-neutral-500">
        Esses dados também aparecem como sua assinatura nos orçamentos gerados.
      </p>

      <form
        onSubmit={handleProfileSubmit}
        className="mt-6 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Dados pessoais</h2>

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

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Assinatura</h2>
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
              className="h-16 max-w-[220px] rounded-lg border border-neutral-200 bg-neutral-50 object-contain p-2"
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

        <input
          type="file"
          accept="image/*"
          className="mt-3 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadSignature.mutate(file)
            e.target.value = ''
          }}
        />
        {uploadSignature.isPending && <p className="mt-1 text-xs text-neutral-400">Enviando…</p>}
      </div>

      <form
        onSubmit={handlePasswordSubmit}
        className="mt-6 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Trocar senha</h2>

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
