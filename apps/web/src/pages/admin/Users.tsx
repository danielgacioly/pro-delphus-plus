import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, UserDTO } from '@prodelphusplus/shared'
import { api } from '../../lib/api'
import { ResetPasswordModal } from '../../components/ResetPasswordModal'
import { Badge } from '../../components/Badge'

async function fetchUsers() {
  const { data } = await api.get<{ users: UserDTO[] }>('/users')
  return data.users
}

const statusLabel: Record<UserDTO['status'], { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  PENDING: { label: 'Aguardando aprovação', tone: 'warning' },
  APPROVED: { label: 'Aprovado', tone: 'success' },
  REJECTED: { label: 'Rejeitado', tone: 'neutral' },
}

export function AdminUsers() {
  const queryClient = useQueryClient()
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('USER')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [resetPasswordMessage, setResetPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [resettingUser, setResettingUser] = useState<UserDTO | null>(null)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createUser = useMutation({
    mutationFn: async () => {
      await api.post('/users', { name, email, password, role, phone: phone || undefined, jobTitle: jobTitle || undefined })
    },
    onSuccess: () => {
      invalidate()
      setName('')
      setEmail('')
      setPassword('')
      setRole('USER')
      setPhone('')
      setJobTitle('')
      setFormError(null)
    },
    onError: () => setFormError('Não foi possível criar a conta. Verifique os dados.'),
  })

  const approve = useMutation({
    mutationFn: async (id: string) => api.post(`/users/${id}/approve`),
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: async (id: string) => api.post(`/users/${id}/reject`),
    onSuccess: invalidate,
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await api.patch(`/users/${id}`, { active })
    },
    onSuccess: invalidate,
  })

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      await api.patch(`/users/${id}`, { role })
    },
    onSuccess: invalidate,
  })

  const resetPassword = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      await api.post(`/users/${id}/reset-password`, { password: newPassword })
    },
    onSuccess: () => {
      setResettingUser(null)
      setResetPasswordError(null)
      setResetPasswordMessage({ type: 'success', text: 'Senha redefinida com sucesso.' })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível redefinir a senha. Tente novamente.'
      setResetPasswordError(message)
    },
  })

  const pending = users?.filter((u) => u.status === 'PENDING') ?? []
  const others = users?.filter((u) => u.status !== 'PENDING') ?? []
  const inputClass =
    'rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Contas cadastradas</h1>
      <p className="mt-1 text-neutral-500">Gerencie o acesso dos usuários ao Pro Delphus+.</p>

      {pending.length > 0 && (
        <div className="animate-fade-in-up mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Aguardando aprovação ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((u, index) => (
              <div
                key={u.id}
                className="animate-fade-in-up flex items-center justify-between rounded-lg bg-white px-4 py-2.5 shadow-sm transition-shadow hover:shadow-md"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{u.name}</p>
                  <p className="text-xs text-neutral-500">
                    {u.email} {u.jobTitle && `· ${u.jobTitle}`}
                  </p>
                </div>
                <div className="space-x-3">
                  <button
                    onClick={() => approve.mutate(u.id)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => reject.mutate(u.id)}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createUser.mutate()
        }}
        className="mt-6 grid max-w-2xl grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <h2 className="col-span-2 text-sm font-semibold text-neutral-700">Criar conta diretamente</h2>
        {formError && <div className="col-span-2 text-sm text-brand-600">{formError}</div>}
        <input
          placeholder="Nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="E-mail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Senha temporária"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
          <option value="USER">Usuário</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <input
          placeholder="Cargo (ex: Vendedor)"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className={inputClass}
        />
        <input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        <button
          type="submit"
          disabled={createUser.isPending}
          className="col-span-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-black active:scale-[0.99] disabled:opacity-60"
        >
          {createUser.isPending ? 'Criando…' : 'Criar conta (aprovada automaticamente)'}
        </button>
      </form>

      {resetPasswordMessage && (
        <div
          className={`animate-fade-in-up mt-6 rounded-lg px-3 py-2 text-sm ${
            resetPasswordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'
          }`}
        >
          {resetPasswordMessage.text}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">E-mail</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Papel</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Situação</th>
                <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-neutral-400">
                    Carregando…
                  </td>
                </tr>
              )}
              {others.map((u, index) => (
                <tr
                  key={u.id}
                  className="animate-fade-in-up transition-colors hover:bg-neutral-50"
                  style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                >
                  <td className="px-4 py-2.5 font-medium text-ink-900">{u.name}</td>
                  <td className="px-4 py-2.5 text-neutral-500">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs transition-colors hover:border-neutral-400"
                    >
                      <option value="USER">Usuário</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </td>
                  <td className="space-x-1.5 px-4 py-2.5">
                    <Badge tone={statusLabel[u.status].tone}>{statusLabel[u.status].label}</Badge>
                    {u.status === 'APPROVED' && <Badge tone={u.active ? 'success' : 'neutral'}>{u.active ? 'Ativo' : 'Desativado'}</Badge>}
                  </td>
                  <td className="space-x-2 px-4 py-2.5 text-right">
                    {u.status === 'REJECTED' && (
                      <button
                        onClick={() => approve.mutate(u.id)}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Aprovar
                      </button>
                    )}
                    {u.status === 'APPROVED' && (
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setResetPasswordMessage(null)
                        setResetPasswordError(null)
                        setResettingUser(u)
                      }}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Redefinir senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resettingUser && (
        <ResetPasswordModal
          userName={resettingUser.name}
          isPending={resetPassword.isPending}
          error={resetPasswordError}
          onCancel={() => setResettingUser(null)}
          onConfirm={(newPassword) => resetPassword.mutate({ id: resettingUser.id, newPassword })}
        />
      )}
    </div>
  )
}
