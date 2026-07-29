import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { UserDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const shortcuts = [
  { to: '/orcamentos/novo', title: 'Novo orçamento', description: 'Gere um orçamento em PDF a partir do SKU do produto.' },
  { to: '/precos', title: 'Tabela de preços', description: 'Consulte preços em reais e em dólar por setor.' },
  { to: '/produtos', title: 'Produtos', description: 'Veja o catálogo, mídia e customizações disponíveis.' },
  { to: '/pedidos', title: 'Pedidos', description: 'Invoice, Packing List e documentos de exportação.' },
]

const adminShortcuts = [
  { to: '/admin/contas', title: 'Contas', description: 'Aprove cadastros e gerencie o acesso dos usuários.' },
  { to: '/admin/setores', title: 'Setores', description: 'Crie, renomeie e exclua os setores do catálogo.' },
  { to: '/admin/metricas', title: 'Métricas', description: 'Vendas por período, status dos pedidos e produtos mais vendidos.' },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

function AccountSection() {
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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Minha Conta</h2>

      <form onSubmit={handleProfileSubmit} className="rounded-xl border border-neutral-200 bg-white p-4">
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

export function Home() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">
        {greeting()}, {user?.name?.split(' ')[0]}
      </h1>
      <p className="mt-1 text-neutral-500">Bem-vindo ao seu Pro Delphus+. O que você deseja fazer hoje?</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-300 hover:shadow-sm"
          >
            <div className="mb-2 h-1.5 w-8 rounded-full bg-brand-500 transition-all group-hover:w-12" />
            <h2 className="font-semibold text-ink-900">{s.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
          </Link>
        ))}
      </div>

      {user?.role === 'ADMIN' && (
        <>
          <h2 className="mt-10 mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Administração
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminShortcuts.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-300 hover:shadow-sm"
              >
                <div className="mb-2 h-1.5 w-8 rounded-full bg-ink-900 transition-all group-hover:w-12" />
                <h2 className="font-semibold text-ink-900">{s.title}</h2>
                <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mt-10">
        <AccountSection />
      </div>
    </div>
  )
}
