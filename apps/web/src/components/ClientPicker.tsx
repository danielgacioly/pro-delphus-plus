import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClientDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { cn } from '../lib/cn'
import { Modal } from './Modal'
import { CLIENT_KIND_LABEL, ClientForm, emptyClientForm, type ClientFormValues } from './ClientForm'
import { Button, Input } from './ui'
import { IconBuilding, IconPlus, IconUser } from './icons'

async function searchClients(search: string) {
  const { data } = await api.get<{ clients: ClientDTO[] }>('/clients', { params: { search } })
  return data.clients
}

/**
 * Escolha de cliente no orçamento: busca no cadastro, cria na hora, ou segue
 * sem vínculo digitando só o nome.
 *
 * O nome avulso continua existindo porque o orçamento é frequentemente o
 * primeiro contato — obrigar um cadastro completo antes de cotar atrapalharia
 * o vendedor. Quem for escolhido preenche `clientId`; quem for digitado vai
 * apenas como `clientName` no documento.
 */
export function ClientPicker({
  clientId,
  clientName,
  onChange,
  preselectId,
}: {
  clientId: string | null
  clientName: string
  onChange: (value: { clientId: string | null; clientName: string; client: ClientDTO | null }) => void
  /** Pré-seleciona um cliente vindo da URL (ex.: botão "Orçamento" na ficha). */
  preselectId?: string | null
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<ClientDTO | null>(null)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const search = clientName.trim()
  const { data: results } = useQuery({
    queryKey: ['client-search', search],
    queryFn: () => searchClients(search),
    enabled: open,
  })

  const { data: preselected } = useQuery({
    queryKey: ['client', preselectId],
    queryFn: async () => {
      const { data } = await api.get<{ client: ClientDTO }>(`/clients/${preselectId}`)
      return data.client
    },
    enabled: Boolean(preselectId) && !clientId,
  })

  useEffect(() => {
    if (!preselected || clientId) return
    setSelected(preselected)
    onChange({ clientId: preselected.id, clientName: preselected.name, client: preselected })
    // onChange vem do pai e muda a cada render; depender dele reexecutaria em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected, clientId])

  function pick(client: ClientDTO) {
    setSelected(client)
    setOpen(false)
    onChange({ clientId: client.id, clientName: client.name, client })
  }

  function clear() {
    setSelected(null)
    onChange({ clientId: null, clientName: '', client: null })
  }

  const createMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const { data } = await api.post<{ client: ClientDTO }>('/clients', values)
      return data.client
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setCreating(false)
      setFormError(null)
      pick(client)
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      setFormError(err.response?.data?.message ?? 'Não foi possível salvar o cliente.'),
  })

  if (selected) {
    const Icon = selected.kind === 'INDIVIDUAL' ? IconUser : IconBuilding
    const place = [selected.city, selected.state, selected.country].filter(Boolean).join(', ')
    return (
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-500/8 text-neutral-500">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{selected.name}</p>
          <p className="truncate text-[12.5px] text-neutral-500">
            {[selected.institution || CLIENT_KIND_LABEL[selected.kind], place].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Trocar
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        <Input
          required
          placeholder="Buscar cliente cadastrado ou digitar um nome"
          value={clientName}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ clientId: null, clientName: e.target.value, client: null })
            setOpen(true)
          }}
          // Espera o clique na sugestão antes de fechar — blur dispara primeiro.
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />

        {open && (
          <div className="animate-scale-in absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
            <div className="max-h-64 overflow-y-auto">
              {(results ?? []).length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-neutral-500">
                  {search ? 'Nenhum cliente encontrado com esse nome.' : 'Comece a digitar para buscar.'}
                </p>
              ) : (
                (results ?? []).slice(0, 8).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(client)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                      'transition-colors duration-150 hover:bg-neutral-500/6',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink-900">{client.name}</p>
                      <p className="truncate text-[12px] text-neutral-500">
                        {[client.institution || CLIENT_KIND_LABEL[client.kind], client.city, client.country]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-[11.5px] text-neutral-400">
                      {client.stats.quoteCount} orç.
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false)
                setCreating(true)
              }}
              className="flex w-full items-center gap-2 border-t border-neutral-200/70 bg-neutral-50/70 px-4 py-2.5 text-left text-[13px] font-medium text-brand-600 transition-colors hover:bg-neutral-500/6"
            >
              <IconPlus className="h-4 w-4" />
              Cadastrar novo cliente{search ? ` “${search}”` : ''}
            </button>
          </div>
        )}
      </div>

      {creating && (
        <Modal onClose={() => setCreating(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-scale-in max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-title text-ink-900">Novo cliente</h2>
            <p className="mt-1 text-[13px] text-neutral-500">
              Ele já entra selecionado neste orçamento — o cadastro completo pode ser feito depois.
            </p>
            <div className="mt-5">
              <ClientForm
                compact
                initial={{ ...emptyClientForm, name: search }}
                submitLabel="Cadastrar e usar"
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
    </>
  )
}
