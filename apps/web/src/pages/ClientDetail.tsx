import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatAmount, formatOrderNumber, type ClientDTO, type OrderStatus, type QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Modal } from '../components/Modal'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { CLIENT_KIND_LABEL, ClientForm, clientToForm, type ClientFormValues } from '../components/ClientForm'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Page,
  Section,
  Skeleton,
  TBody,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Tr,
} from '../components/ui'
import { BackLink } from '../components/ui'
import { IconGlobe, IconMail, IconPhone, IconPin, IconPlus, IconQuote } from '../components/icons'

interface ClientOrderRow {
  id: string
  orderNumber: number
  status: OrderStatus
  createdAt: string
  quoteNumber: string
  total: string
  currency: string
}

interface ClientDetailResponse {
  client: ClientDTO
  quotes: QuoteDTO[]
  orders: ClientOrderRow[]
}

async function fetchClient(id: string) {
  const { data } = await api.get<ClientDetailResponse>(`/clients/${id}`)
  return data
}

const currencySymbol: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] text-neutral-600">
      <span className="mt-0.5 shrink-0 text-neutral-400">{icon}</span>
      <span className="min-w-0 wrap-break-word">{children}</span>
    </div>
  )
}

function AddressBlock({ title, text }: { title: string; text: string | null }) {
  return (
    <div>
      <p className="text-eyebrow text-neutral-400">{title}</p>
      {text ? (
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">{text}</p>
      ) : (
        <p className="mt-1.5 text-[13px] text-neutral-400">Não informado</p>
      )}
    </div>
  )
}

export function ClientDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()

  const { data, isLoading, isError } = useQuery({ queryKey: ['client', id], queryFn: () => fetchClient(id) })

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['client', id] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
  }

  const updateMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const { data: res } = await api.patch<{ client: ClientDTO }>(`/clients/${id}`, values)
      return res.client
    },
    onSuccess: () => {
      invalidate()
      setEditing(false)
      setFormError(null)
      toast.success('Cliente atualizado.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      setFormError(err.response?.data?.message ?? 'Não foi possível salvar as alterações.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await api.delete<{ deactivated?: boolean }>(`/clients/${id}`)
      return res
    },
    onSuccess: (res) => {
      invalidate()
      setDeleting(false)
      toast.success(res?.deactivated ? 'Cliente desativado.' : 'Cliente excluído.')
      // Com histórico, o servidor apenas desativa — o cliente continua existindo
      // e faz sentido permanecer na tela mostrando o estado novo.
      if (!res?.deactivated) navigate('/clientes')
    },
  })

  if (isLoading) {
    return (
      <Page title="Cliente">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="mt-4 h-64 rounded-2xl" />
      </Page>
    )
  }

  if (isError || !data) {
    return (
      <Page title="Cliente">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          Não foi possível carregar esse cliente.
        </div>
      </Page>
    )
  }

  const { client, quotes, orders } = data
  const place = [client.city, client.state, client.country].filter(Boolean).join(', ')
  const conversion = client.stats.quoteCount > 0 ? client.stats.orderCount / client.stats.quoteCount : 0

  return (
    <Page
      title={client.name}
      description={
        <>
          {CLIENT_KIND_LABEL[client.kind]}
          {client.institution ? ` · ${client.institution}` : ''}
        </>
      }
      actions={
        <Button size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
      }
    >
      <div className="-mt-4 mb-6">
        <BackLink to="/clientes">Clientes</BackLink>
      </div>

      {!client.active && (
        <div className="mb-5 rounded-xl bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800">
          Este cliente está inativo. O histórico continua disponível, mas ele não deve receber novos orçamentos.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <p className="text-eyebrow text-neutral-400">Contato</p>
          <div className="mt-3 space-y-2.5">
            {client.email ? (
              <ContactLine icon={<IconMail className="h-4 w-4" />}>
                <a href={`mailto:${client.email}`} className="hover:text-brand-600">
                  {client.email}
                </a>
              </ContactLine>
            ) : null}
            {client.phone && <ContactLine icon={<IconPhone className="h-4 w-4" />}>{client.phone}</ContactLine>}
            {place && <ContactLine icon={<IconPin className="h-4 w-4" />}>{place}</ContactLine>}
            {client.website && (
              <ContactLine icon={<IconGlobe className="h-4 w-4" />}>
                <a
                  href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-brand-600"
                >
                  {client.website}
                </a>
              </ContactLine>
            )}
            {client.taxId && <p className="text-[13px] text-neutral-600">CNPJ / Tax ID: {client.taxId}</p>}
            {!client.email && !client.phone && !place && !client.website && (
              <p className="text-[13px] text-neutral-400">Nenhum contato cadastrado.</p>
            )}
          </div>

          <div className="mt-5 space-y-4 border-t border-neutral-200/70 pt-5">
            <AddressBlock title="Faturamento" text={client.billToText} />
            <AddressBlock title="Entrega" text={client.shipToText} />
          </div>

          {client.notes && (
            <div className="mt-5 border-t border-neutral-200/70 pt-5">
              <p className="text-eyebrow text-neutral-400">Observações</p>
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">{client.notes}</p>
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Orçamentos', value: client.stats.quoteCount },
              { label: 'Pedidos', value: client.stats.orderCount },
              { label: 'Conversão', value: `${Math.round(conversion * 100)}%` },
              { label: 'Total orçado', value: formatAmount(client.stats.totalQuoted) },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <p className="text-eyebrow text-neutral-400">{stat.label}</p>
                <p className="tabular mt-2 text-[22px] font-bold leading-none text-ink-900">{stat.value}</p>
              </Card>
            ))}
          </div>

          <Section title="Orçamentos" className="mt-6">
            <TableShell>
              <Table>
                <THead>
                  <tr>
                    <Th>Número</Th>
                    <Th>Data</Th>
                    <Th>Itens</Th>
                    <Th align="right">Total</Th>
                    <Th>Responsável</Th>
                  </tr>
                </THead>
                <TBody>
                  {quotes.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={IconQuote}
                          title="Nenhum orçamento ainda"
                          description="Gere o primeiro orçamento para este cliente."
                          action={
                            <ButtonLink variant="primary" to={`/orcamentos/novo?clientId=${client.id}`}>
                              <IconPlus className="h-4 w-4" />
                              Novo orçamento
                            </ButtonLink>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    quotes.map((quote) => (
                      <Tr key={quote.id}>
                        <Td>
                          <span className="font-medium text-ink-900">{quote.quoteNumber}</span>
                        </Td>
                        <Td className="text-neutral-500">{formatDate(quote.createdAt)}</Td>
                        <Td className="text-neutral-500">{quote.items.length}</Td>
                        <Td align="right" className="tabular font-medium text-ink-900">
                          {currencySymbol[quote.currency] ?? ''} {formatAmount(quote.total)}
                        </Td>
                        <Td className="text-neutral-500">{quote.createdBy.name}</Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </TableShell>
          </Section>

          <Section title="Pedidos" className="mt-6">
            <TableShell>
              <Table>
                <THead>
                  <tr>
                    <Th>Pedido</Th>
                    <Th>Orçamento</Th>
                    <Th>Data</Th>
                    <Th align="right">Total</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <TBody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState title="Nenhum pedido fechado" description="Os pedidos deste cliente aparecem aqui." />
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <Tr key={order.id} interactive onClick={() => navigate(`/pedidos/${order.id}`)}>
                        <Td>
                          <span className="font-medium text-ink-900">#{formatOrderNumber(order.orderNumber)}</span>
                        </Td>
                        <Td className="text-neutral-500">{order.quoteNumber}</Td>
                        <Td className="text-neutral-500">{formatDate(order.createdAt)}</Td>
                        <Td align="right" className="tabular font-medium text-ink-900">
                          {currencySymbol[order.currency] ?? ''} {formatAmount(order.total)}
                        </Td>
                        <Td>
                          <Badge tone={order.status === 'COMPLETED' ? 'success' : 'warning'} dot>
                            {order.status === 'COMPLETED' ? 'Concluído' : 'Pendente'}
                          </Badge>
                        </Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </TableShell>
          </Section>

          {user?.role === 'ADMIN' && (
            <div className="mt-8 flex justify-end">
              <Button variant="ghost" className="text-brand-600" onClick={() => setDeleting(true)}>
                {client.stats.quoteCount > 0 ? 'Desativar cliente' : 'Excluir cliente'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-scale-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-title text-ink-900">Editar cliente</h2>
            <div className="mt-5">
              <ClientForm
                initial={clientToForm(client)}
                submitLabel="Salvar alterações"
                isPending={updateMutation.isPending}
                error={formError}
                onSubmit={(values) => updateMutation.mutate(values)}
                onCancel={() => {
                  setEditing(false)
                  setFormError(null)
                }}
              />
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDeleteModal
          title={client.stats.quoteCount > 0 ? 'Desativar cliente' : 'Excluir cliente'}
          description={
            client.stats.quoteCount > 0
              ? `${client.name} tem ${client.stats.quoteCount} orçamento(s). Ele será desativado e o histórico permanece intacto.`
              : `${client.name} será removido definitivamente.`
          }
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </Page>
  )
}
