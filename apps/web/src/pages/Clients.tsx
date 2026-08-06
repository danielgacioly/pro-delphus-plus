import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClientDTO, ClientKind } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { Modal } from '../components/Modal'
import { CLIENT_KIND_LABEL, ClientForm, type ClientFormValues } from '../components/ClientForm'
import {
  AnimatedNumber,
  Badge,
  Button,
  EmptyState,
  InteractiveCard,
  Page,
  SearchField,
  SegmentedControl,
  Skeleton,
  Toolbar,
} from '../components/ui'
import { IconBuilding, IconContacts, IconMail, IconPin, IconPlus, IconUser } from '../components/icons'

async function fetchClients() {
  const { data } = await api.get<{ clients: ClientDTO[] }>('/clients')
  return data.clients
}

const KIND_ICON = {
  INDIVIDUAL: IconUser,
  INSTITUTION: IconBuilding,
  DISTRIBUTOR: IconContacts,
} as const

function relativeDate(iso: string | null) {
  if (!iso) return 'Sem orçamentos'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30) return `Há ${days} dias`
  const months = Math.floor(days / 30)
  if (months < 12) return `Há ${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  return `Há ${years} ${years === 1 ? 'ano' : 'anos'}`
}

function ClientCard({ client }: { client: ClientDTO }) {
  const Icon = KIND_ICON[client.kind]
  const place = [client.city, client.state, client.country].filter(Boolean).join(', ')

  return (
    <Link to={`/clientes/${client.id}`} className="block focus:outline-none">
      <InteractiveCard className="h-full p-5 focus-visible:ring-4 focus-visible:ring-brand-500/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-500/8 text-neutral-500">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink-900">{client.name}</p>
            <p className="mt-0.5 truncate text-[13px] text-neutral-500">
              {client.institution || CLIENT_KIND_LABEL[client.kind]}
            </p>
          </div>
          {!client.active && <Badge tone="warning">Inativo</Badge>}
        </div>

        <div className="mt-4 space-y-1.5 text-[12.5px] text-neutral-500">
          {client.email && (
            <p className="flex items-center gap-1.5 truncate">
              <IconMail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span className="truncate">{client.email}</span>
            </p>
          )}
          {place && (
            <p className="flex items-center gap-1.5 truncate">
              <IconPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-neutral-200/70 pt-3.5">
          <div className="flex gap-5">
            <div>
              <p className="text-eyebrow text-neutral-400">Orçamentos</p>
              <p className="tabular mt-0.5 text-[17px] font-semibold leading-none text-ink-900">
                {client.stats.quoteCount}
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-neutral-400">Pedidos</p>
              <p className="tabular mt-0.5 text-[17px] font-semibold leading-none text-ink-900">
                {client.stats.orderCount}
              </p>
            </div>
          </div>
          <p className="text-[12px] text-neutral-400">{relativeDate(client.stats.lastQuoteAt)}</p>
        </div>
      </InteractiveCard>
    </Link>
  )
}

export function Clients() {
  const queryClient = useQueryClient()
  const { data: clients, isLoading, isError } = useQuery({ queryKey: ['clients'], queryFn: fetchClients })

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'ALL' | ClientKind>('ALL')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const { data } = await api.post<{ client: ClientDTO }>('/clients', values)
      return data.client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setCreating(false)
      setFormError(null)
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      setFormError(err.response?.data?.message ?? 'Não foi possível salvar o cliente.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (clients ?? []).filter((c) => {
      if (kindFilter !== 'ALL' && c.kind !== kindFilter) return false
      if (!q) return true
      return [c.name, c.institution, c.email, c.city, c.country]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    })
  }, [clients, search, kindFilter])

  const totals = useMemo(() => {
    const list = clients ?? []
    return {
      total: list.length,
      withOrders: list.filter((c) => c.stats.orderCount > 0).length,
      quotes: list.reduce((sum, c) => sum + c.stats.quoteCount, 0),
    }
  }, [clients])

  return (
    <Page
      title="Clientes"
      description="Quem compra da Pro Delphus: contato, endereços, orçamentos e pedidos de cada um."
      actions={
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="h-4 w-4" />
          Novo cliente
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Clientes cadastrados', value: totals.total },
          { label: 'Com pedido fechado', value: totals.withOrders },
          { label: 'Orçamentos vinculados', value: totals.quotes },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{ animationDelay: `${i * 40}ms` }}
            className="animate-fade-in-up rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm"
          >
            <p className="text-eyebrow text-neutral-400">{stat.label}</p>
            <p className="tabular mt-2.5 text-[26px] font-bold leading-none text-ink-900">
              {isLoading ? '—' : <AnimatedNumber value={stat.value} />}
            </p>
          </div>
        ))}
      </div>

      <Toolbar className="mt-8">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, instituição, e-mail ou cidade"
          className="min-w-0 flex-1 sm:max-w-md"
        />
        <SegmentedControl
          aria-label="Tipo de cliente"
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'INDIVIDUAL', label: 'Pessoas' },
            { value: 'INSTITUTION', label: 'Instituições' },
            { value: 'DISTRIBUTOR', label: 'Distribuidores' },
          ]}
        />
      </Toolbar>

      <div className="mt-5">
        {isError ? (
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
            Não foi possível carregar os clientes.
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="mt-4 h-3.5 w-40" />
                <Skeleton className="mt-2 h-3 w-28" />
                <Skeleton className="mt-6 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <EmptyState
              icon={IconContacts}
              title={clients?.length ? 'Nenhum cliente com esse filtro' : 'Nenhum cliente cadastrado'}
              description={
                clients?.length
                  ? 'Ajuste a busca ou o tipo selecionado.'
                  : 'Cadastre o primeiro cliente para vincular orçamentos e pedidos a ele.'
              }
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <IconPlus className="h-4 w-4" />
                  Novo cliente
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((client, i) => (
              <div key={client.id} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} className="animate-fade-in-up">
                <ClientCard client={client} />
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <Modal onClose={() => setCreating(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-scale-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-title text-ink-900">Novo cliente</h2>
            <p className="mt-1 text-[13px] text-neutral-500">
              O que você preencher aqui é reaproveitado nos orçamentos e pedidos desse cliente.
            </p>
            <div className="mt-5">
              <ClientForm
                isPending={createMutation.isPending}
                error={formError}
                onSubmit={(values) => createMutation.mutate(values)}
                onCancel={() => {
                  setCreating(false)
                  setFormError(null)
                }}
              />
            </div>
          </div>
        </Modal>
      )}
    </Page>
  )
}
