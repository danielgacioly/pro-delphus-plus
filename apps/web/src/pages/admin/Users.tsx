import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, UserDTO } from '@prodelphusplus/shared'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { ResetPasswordModal } from '../../components/ResetPasswordModal'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Page,
  Section,
  Select,
  SkeletonRows,
  TBody,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Tr,
} from '../../components/ui'

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
  const [showCreate, setShowCreate] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [resetPasswordMessage, setResetPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [resettingUser, setResettingUser] = useState<UserDTO | null>(null)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserDTO | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createUser = useMutation({
    mutationFn: async () => {
      await api.post('/users', {
        name,
        email,
        password,
        role,
        phone: phone || undefined,
        jobTitle: jobTitle || undefined,
      })
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
      setShowCreate(false)
    },
    onError: () => setFormError('Não foi possível criar a conta. Verifique os dados.'),
  })

  const approve = useMutation({ mutationFn: async (id: string) => api.post(`/users/${id}/approve`), onSuccess: invalidate })
  const reject = useMutation({ mutationFn: async (id: string) => api.post(`/users/${id}/reject`), onSuccess: invalidate })

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

  const deleteUser = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      invalidate()
      setDeletingUser(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível excluir a conta. Tente novamente.'
      setDeleteError(message)
    },
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

  return (
    <Page
      title="Contas"
      description="Gerencie o acesso dos usuários ao Pro Delphus+."
      actions={
        <Button size="sm" variant={showCreate ? 'secondary' : 'primary'} onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? 'Cancelar' : 'Criar conta'}
        </Button>
      }
    >
      {pending.length > 0 && (
        <Card className="mb-6 border-amber-300/50 bg-amber-50/60 p-5">
          <h2 className="mb-3.5 flex items-center gap-2 text-[13px] font-semibold text-amber-900">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Aguardando aprovação ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink-900">{u.name}</p>
                  <p className="truncate text-[12.5px] text-neutral-500">
                    {u.email}
                    {u.jobTitle && ` · ${u.jobTitle}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => approve.mutate(u.id)}
                    className="border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => reject.mutate(u.id)}
                    className="text-neutral-500 hover:bg-brand-50 hover:text-brand-600"
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showCreate && (
        <Card className="animate-fade-in mb-6 max-w-2xl p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createUser.mutate()
            }}
          >
            <h2 className="text-heading mb-4 text-ink-900">Criar conta diretamente</h2>
            {formError && (
              <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{formError}</div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="E-mail">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Senha temporária">
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Papel">
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="USER">Usuário</option>
                  <option value="ADMIN">Administrador</option>
                </Select>
              </Field>
              <Field label="Cargo (opcional)">
                <Input placeholder="ex: Vendedor" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </Field>
              <Field label="Telefone (opcional)">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="primary" disabled={createUser.isPending}>
                {createUser.isPending ? 'Criando…' : 'Criar conta (aprovada automaticamente)'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {resetPasswordMessage && (
        <div
          className={cn(
            'animate-fade-in mb-4 rounded-xl px-4 py-3 text-[13px]',
            resetPasswordMessage.type === 'success' ? 'bg-emerald-500/12 text-emerald-800' : 'bg-brand-50 text-brand-700',
          )}
        >
          {resetPasswordMessage.text}
        </div>
      )}

      <Section title={`Todas as contas${others.length ? ` (${others.length})` : ''}`}>
        <TableShell>
          <Table>
            <THead>
              <tr>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Papel</Th>
                <Th>Situação</Th>
                <Th align="right">Ações</Th>
              </tr>
            </THead>
            <TBody>
              {isLoading && <SkeletonRows rows={5} columns={5} />}

              {others.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium text-ink-900">{u.name}</Td>
                  <Td className="text-neutral-500">{u.email}</Td>
                  <Td>
                    <Select
                      auto
                      aria-label={`Papel de ${u.name}`}
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
                      className="h-8 text-[12.5px]"
                    >
                      <option value="USER">Usuário</option>
                      <option value="ADMIN">Administrador</option>
                    </Select>
                  </Td>
                  <Td>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusLabel[u.status].tone} dot>
                        {statusLabel[u.status].label}
                      </Badge>
                      {u.status === 'APPROVED' && !u.active && <Badge tone="neutral">Desativado</Badge>}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {u.status === 'REJECTED' && (
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(u.id)}
                          className="border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          Aprovar
                        </Button>
                      )}
                      {u.status === 'APPROVED' && (
                        <Button size="sm" onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}>
                          {u.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetPasswordMessage(null)
                          setResetPasswordError(null)
                          setResettingUser(u)
                        }}
                      >
                        Redefinir senha
                      </Button>
                      {u.role !== 'ADMIN' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteError(null)
                            setDeletingUser(u)
                          }}
                          className="text-neutral-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableShell>
      </Section>

      {resettingUser && (
        <ResetPasswordModal
          userName={resettingUser.name}
          isPending={resetPassword.isPending}
          error={resetPasswordError}
          onCancel={() => setResettingUser(null)}
          onConfirm={(newPassword) => resetPassword.mutate({ id: resettingUser.id, newPassword })}
        />
      )}

      {deletingUser && (
        <ConfirmDeleteModal
          title={`Excluir conta de ${deletingUser.name}?`}
          description="Orçamentos, pedidos e produtos atualizados por esta conta passam a ficar registrados no admin principal. Contas de administrador nunca podem ser excluídas."
          isPending={deleteUser.isPending}
          error={deleteError}
          onConfirm={() => deleteUser.mutate(deletingUser.id)}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </Page>
  )
}
