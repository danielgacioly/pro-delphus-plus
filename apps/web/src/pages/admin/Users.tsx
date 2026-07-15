import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, UserDTO } from '@prodelphusplus/shared'
import { api } from '../../lib/api'

async function fetchUsers() {
  const { data } = await api.get<{ users: UserDTO[] }>('/users')
  return data.users
}

const statusLabel: Record<UserDTO['status'], { label: string; className: string }> = {
  PENDING: { label: 'Aguardando aprovação', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprovado', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejeitado', className: 'bg-neutral-200 text-neutral-600' },
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
    mutationFn: async (id: string) => {
      const newPassword = window.prompt('Nova senha temporária (mínimo 6 caracteres):')
      if (!newPassword) throw new Error('cancelled')
      await api.post(`/users/${id}/reset-password`, { password: newPassword })
    },
  })

  const pending = users?.filter((u) => u.status === 'PENDING') ?? []
  const others = users?.filter((u) => u.status !== 'PENDING') ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Contas cadastradas</h1>
      <p className="mt-1 text-neutral-500">Gerencie o acesso dos usuários ao Pro Delphus+.</p>

      {pending.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-800">
            Aguardando aprovação ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 shadow-sm"
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
                    className="text-xs font-semibold text-green-700 hover:underline"
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
        className="mt-6 grid max-w-2xl grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="col-span-2 text-sm font-semibold text-neutral-700">Criar conta diretamente</h2>
        {formError && <div className="col-span-2 text-sm text-brand-600">{formError}</div>}
        <input
          placeholder="Nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="E-mail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Senha temporária"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="USER">Usuário</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <input
          placeholder="Cargo (ex: Vendedor)"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createUser.isPending}
          className="col-span-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {createUser.isPending ? 'Criando…' : 'Criar conta (aprovada automaticamente)'}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Nome</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">E-mail</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Papel</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Situação</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-500">Ações</th>
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
            {others.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 text-ink-900">{u.name}</td>
                <td className="px-4 py-2 text-neutral-500">{u.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  >
                    <option value="USER">Usuário</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </td>
                <td className="px-4 py-2 space-x-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusLabel[u.status].className}`}>
                    {statusLabel[u.status].label}
                  </span>
                  {u.status === 'APPROVED' && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {u.active ? 'Ativo' : 'Desativado'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  {u.status === 'REJECTED' && (
                    <button
                      onClick={() => approve.mutate(u.id)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      Aprovar
                    </button>
                  )}
                  {u.status === 'APPROVED' && (
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                  )}
                  <button
                    onClick={() => resetPassword.mutate(u.id)}
                    className="text-xs font-medium text-brand-600 hover:underline"
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
  )
}
