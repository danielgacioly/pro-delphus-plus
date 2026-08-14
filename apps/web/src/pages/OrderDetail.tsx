import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { formatAmount, formatOrderNumber, type OrderDTO, type PrepaymentMethod } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoxAssignmentEditor } from '../hooks/useBoxAssignmentEditor'
import { BoxAssignmentFields } from '../components/BoxAssignmentFields'
import { DropZone } from '../components/DropZone'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { IconAlert } from '../components/icons'
import {
  BackLink,
  Button,
  Card,
  Field,
  Input,
  Page,
  Section,
  Select,
  Skeleton,
  TBody,
  Textarea,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Tr,
} from '../components/ui'

async function fetchOrder(id: string) {
  const { data } = await api.get<{ order: OrderDTO }>(`/orders/${id}`)
  return data.order
}

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-eyebrow text-neutral-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-900">
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  )
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function DocLink({ href, children, tone = 'brand' }: { href: string; children: ReactNode; tone?: 'brand' | 'ink' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:shadow-md active:scale-[0.97] ${
        tone === 'brand' ? 'bg-brand-600 hover:bg-brand-700' : 'bg-ink-900 hover:bg-black'
      }`}
    >
      {children}
    </a>
  )
}

function ManualUpload({
  title,
  url,
  onFile,
  isPending,
}: {
  title: string
  url: string | null | undefined
  onFile: (file: File) => void
  isPending: boolean
}) {
  return (
    <div className="border-t border-neutral-200/70 pt-4">
      <h3 className="text-eyebrow mb-2 text-neutral-500">{title}</h3>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium text-brand-600 hover:underline"
        >
          Ver arquivo enviado
        </a>
      ) : (
        <p className="text-[13px] text-neutral-400">Nenhum arquivo enviado.</p>
      )}
      <DropZone
        className="mt-2.5 py-3"
        disabled={isPending}
        onFiles={(files) => {
          const file = files[0]
          if (file) onFile(file)
        }}
      >
        <p className="text-[12.5px] text-neutral-500">
          Arraste o arquivo ou <span className="font-medium text-brand-600">clique para selecionar</span>
        </p>
      </DropZone>
    </div>
  )
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  })

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const boxEditor = useBoxAssignmentEditor()
  const [editForm, setEditForm] = useState<
    Partial<{
      purchaseOrder: string
      orderedByEmail: string
      shipDate: string
      billToText: string
      shipToText: string
      shipToNote: string
      netWeightKg: string
      grossWeightKg: string
      awbNumber: string
      incoterms: string
      prepaymentBy: PrepaymentMethod
      paypalFee: string
      nfNumber: string
      nfDate: string
      exchangeRate: string
    }>
  >({})

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  const updateOrder = useMutation({
    mutationFn: async () => {
      const { itemWeightsKg, packageCount, boxAssignments } = boxEditor.buildPayload()
      const payload = {
        purchaseOrder: editForm.purchaseOrder || undefined,
        orderedByEmail: editForm.orderedByEmail || undefined,
        shipDate: editForm.shipDate || undefined,
        billToText: editForm.billToText || undefined,
        shipToText: editForm.shipToText || undefined,
        shipToNote: editForm.shipToNote || undefined,
        netWeightKg: editForm.netWeightKg ? Number(editForm.netWeightKg) : undefined,
        grossWeightKg: editForm.grossWeightKg ? Number(editForm.grossWeightKg) : undefined,
        awbNumber: editForm.awbNumber || undefined,
        incoterms: editForm.incoterms || undefined,
        prepaymentBy: editForm.prepaymentBy,
        paypalFee: editForm.paypalFee ? Number(editForm.paypalFee) : undefined,
        nfNumber: editForm.nfNumber || undefined,
        nfDate: editForm.nfDate || undefined,
        exchangeRate: editForm.exchangeRate ? Number(editForm.exchangeRate) : undefined,
        itemWeightsKg,
        packageCount,
        boxAssignments,
      }
      await api.patch(`/orders/${id}`, payload)
    },
    onSuccess: () => {
      invalidate()
      setEditing(false)
      toast.success('Pedido atualizado.')
    },
  })

  const uploadAwb = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/orders/${id}/awb-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('AWB enviado.')
    },
  })

  const uploadNf = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/orders/${id}/nf-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Nota fiscal enviada.')
    },
  })

  const deleteOrder = useMutation({
    mutationFn: async () => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Pedido excluído.')
      navigate('/pedidos')
    },
  })

  async function downloadAllDocuments() {
    if (!order) return
    setDownloadingAll(true)
    try {
      // Disparar um <a download> por arquivo em sequência esbarrava no
      // bloqueio do navegador para downloads automáticos consecutivos sem
      // gesto do usuário a cada um — só o primeiro saía, o resto sumia sem
      // erro. O servidor agora empacota tudo num único .zip.
      const { data } = await api.get<Blob>(`/orders/${order.id}/documents.zip`, { responseType: 'blob' })
      triggerBlobDownload(data, `Order-${formatOrderNumber(order.orderNumber)}-Documents.zip`)
    } catch {
      toast.error('Não foi possível baixar os documentos.')
    } finally {
      setDownloadingAll(false)
    }
  }

  function startEdit() {
    if (!order) return
    setEditForm({
      purchaseOrder: order.purchaseOrder ?? '',
      orderedByEmail: order.orderedByEmail,
      shipDate: order.shipDate ? order.shipDate.slice(0, 10) : '',
      billToText: order.billToText,
      shipToText: order.shipToText,
      shipToNote: order.shipToNote ?? '',
      netWeightKg: order.netWeightKg ?? '',
      grossWeightKg: order.grossWeightKg ?? '',
      awbNumber: order.awbNumber ?? '',
      incoterms: order.incoterms ?? '',
      prepaymentBy: order.prepaymentBy,
      paypalFee: order.paypalFee ?? '',
      nfNumber: order.nfNumber ?? '',
      nfDate: order.nfDate ? order.nfDate.slice(0, 10) : '',
      exchangeRate: order.exchangeRate ?? '',
    })
    boxEditor.loadExisting({
      items: order.quote.items,
      packageCount: order.packageCount,
      itemWeightsKg: order.itemWeightsKg,
      boxAssignments: order.boxAssignments,
    })
    setEditing(true)
  }

  if (isLoading) {
    return (
      <Page title="Pedido">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </Page>
    )
  }

  if (isError || !order) {
    return (
      <Page title="Pedido">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          Não foi possível carregar este pedido.
        </div>
      </Page>
    )
  }

  const currency = order.quote.currency

  return (
    <Page
      title={`Pedido #${formatOrderNumber(order.orderNumber)}`}
      description={`A partir do orçamento ${order.quoteNumber} — ${order.quote.clientName}`}
      actions={
        <Button size="sm" variant={editing ? 'secondary' : 'primary'} onClick={editing ? () => setEditing(false) : startEdit}>
          {editing ? 'Cancelar' : 'Editar'}
        </Button>
      }
    >
      <div className="-mt-4 mb-6">
        <BackLink to="/pedidos">Pedidos</BackLink>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-heading text-ink-900">Documentos</h2>
            {(order.invoicePdfUrl || order.packingListPdfUrl || order.packingListBoxPdfUrl || order.exportDocXlsxUrl) && (
              <Button size="sm" variant="secondary" disabled={downloadingAll} onClick={downloadAllDocuments}>
                {downloadingAll ? 'Baixando…' : 'Baixar tudo'}
              </Button>
            )}
          </div>

          {order.documentsStale && (
            <div className="animate-fade-in mt-4 flex items-start gap-2.5 rounded-xl bg-brand-50 px-3.5 py-3 text-[13px] text-brand-700">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                O orçamento vinculado foi editado depois da última geração destes documentos — os arquivos abaixo podem
                estar desatualizados.{' '}
                {!editing && (
                  <button type="button" onClick={startEdit} className="font-medium underline underline-offset-2">
                    Editar pedido para atualizar
                  </button>
                )}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {order.invoicePdfUrl && <DocLink href={order.invoicePdfUrl}>Invoice</DocLink>}
            {order.packingListPdfUrl && <DocLink href={order.packingListPdfUrl}>Packing List</DocLink>}
            {order.packingListBoxPdfUrl && <DocLink href={order.packingListBoxPdfUrl}>Packing List Box</DocLink>}
            {order.exportDocXlsxUrl && (
              <DocLink href={order.exportDocXlsxUrl} tone="ink">
                Doc. de Exportação
              </DocLink>
            )}
          </div>

          <div className="mt-5 space-y-4">
            <ManualUpload
              title="AWB (manual)"
              url={order.awbDocumentUrl}
              isPending={uploadAwb.isPending}
              onFile={(file) => uploadAwb.mutate(file)}
            />
            <ManualUpload
              title="Nota Fiscal (manual)"
              url={order.nfDocumentUrl}
              isPending={uploadNf.isPending}
              onFile={(file) => uploadNf.mutate(file)}
            />
          </div>
        </Card>

        <Card className={editing ? 'p-5 lg:col-span-2' : 'p-5'}>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                updateOrder.mutate()
              }}
            >
              <h2 className="text-heading mb-4 text-ink-900">Editar pedido</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Purchase Order">
                    <Input
                      value={editForm.purchaseOrder}
                      onChange={(e) => setEditForm((s) => ({ ...s, purchaseOrder: e.target.value }))}
                    />
                  </Field>
                  <Field label="E-mail do comprador">
                    <Input
                      type="email"
                      value={editForm.orderedByEmail}
                      onChange={(e) => setEditForm((s) => ({ ...s, orderedByEmail: e.target.value }))}
                    />
                  </Field>
                  <Field label="Data de expedição">
                    <Input
                      type="date"
                      value={editForm.shipDate}
                      onChange={(e) => setEditForm((s) => ({ ...s, shipDate: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Bill To">
                    <Textarea
                      rows={5}
                      value={editForm.billToText}
                      onChange={(e) => setEditForm((s) => ({ ...s, billToText: e.target.value }))}
                    />
                  </Field>
                  <Field label="Ship To">
                    <Textarea
                      rows={5}
                      value={editForm.shipToText}
                      onChange={(e) => setEditForm((s) => ({ ...s, shipToText: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Observação de entrega (opcional)">
                  <Input
                    value={editForm.shipToNote}
                    onChange={(e) => setEditForm((s) => ({ ...s, shipToNote: e.target.value }))}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Peso líquido (kg)">
                    <Input
                      type="number"
                      step="0.001"
                      className="tabular"
                      value={editForm.netWeightKg}
                      onChange={(e) => setEditForm((s) => ({ ...s, netWeightKg: e.target.value }))}
                    />
                  </Field>
                  <Field label="Peso bruto (kg)">
                    <Input
                      type="number"
                      step="0.001"
                      className="tabular"
                      value={editForm.grossWeightKg}
                      onChange={(e) => setEditForm((s) => ({ ...s, grossWeightKg: e.target.value }))}
                    />
                  </Field>
                </div>

                <BoxAssignmentFields editor={boxEditor} items={order.quote.items} />

                <div className="grid grid-cols-2 gap-4">
                  <Field label="AWB #">
                    <Input
                      value={editForm.awbNumber}
                      onChange={(e) => setEditForm((s) => ({ ...s, awbNumber: e.target.value }))}
                    />
                  </Field>
                  <Field label="Incoterms">
                    <Input
                      value={editForm.incoterms}
                      onChange={(e) => setEditForm((s) => ({ ...s, incoterms: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Prepayment by">
                    <Select
                      value={editForm.prepaymentBy}
                      onChange={(e) => setEditForm((s) => ({ ...s, prepaymentBy: e.target.value as PrepaymentMethod }))}
                    >
                      <option value="WIRE_TRANSFER">Wire Transfer</option>
                      <option value="PAYPAL">PayPal</option>
                    </Select>
                  </Field>
                  {editForm.prepaymentBy === 'PAYPAL' && (
                    <Field label="Taxa do PayPal">
                      <Input
                        type="number"
                        step="0.01"
                        className="tabular"
                        value={editForm.paypalFee}
                        onChange={(e) => setEditForm((s) => ({ ...s, paypalFee: e.target.value }))}
                      />
                    </Field>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Número da NF">
                    <Input
                      value={editForm.nfNumber}
                      onChange={(e) => setEditForm((s) => ({ ...s, nfNumber: e.target.value }))}
                    />
                  </Field>
                  <Field label="Emissão da NF">
                    <Input
                      type="date"
                      value={editForm.nfDate}
                      onChange={(e) => setEditForm((s) => ({ ...s, nfDate: e.target.value }))}
                    />
                  </Field>
                </div>

                <Field label="Câmbio USD/BRL">
                  <Input
                    type="number"
                    step="0.0001"
                    required
                    className="tabular"
                    value={editForm.exchangeRate}
                    onChange={(e) => setEditForm((s) => ({ ...s, exchangeRate: e.target.value }))}
                  />
                </Field>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed text-neutral-400">
                Salvar regenera automaticamente o Invoice, Packing List, Packing List Box e Documento de Exportação.
              </p>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={updateOrder.isPending}
                className="mt-4 w-full"
              >
                {updateOrder.isPending ? 'Salvando…' : 'Salvar e regenerar documentos'}
              </Button>
            </form>
          ) : (
            <>
              <h2 className="text-heading text-ink-900">Dados do pedido</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <ReadField label="Purchase Order" value={order.purchaseOrder ?? order.quoteNumber} />
                <ReadField label="Ordered By" value={order.orderedByEmail} />
                <ReadField
                  label="Data de expedição"
                  value={order.shipDate ? new Date(order.shipDate).toLocaleDateString('pt-BR') : null}
                />
                <ReadField label="Data do invoice" value={new Date(order.invoiceDate).toLocaleDateString('pt-BR')} />
                <ReadField label="Nº de pacotes" value={order.numberOfPackages} />
                <ReadField label="Peso líquido" value={order.netWeightKg ? `${order.netWeightKg} KG` : null} />
                <ReadField label="Peso bruto" value={order.grossWeightKg ? `${order.grossWeightKg} KG` : null} />
                <ReadField label="Incoterms" value={order.incoterms} />
                <ReadField label="AWB #" value={order.awbNumber} />
                <ReadField
                  label="Prepayment"
                  value={
                    order.prepaymentBy === 'PAYPAL'
                      ? `PayPal (taxa ${currency} ${formatAmount(order.paypalFee ?? 0)})`
                      : 'Wire Transfer'
                  }
                />
                <ReadField label="Número da NF" value={order.nfNumber} />
                <ReadField
                  label="Emissão da NF"
                  value={order.nfDate ? new Date(order.nfDate).toLocaleDateString('pt-BR') : null}
                />
                <ReadField label="Câmbio USD/BRL" value={order.exchangeRate} />
                <ReadField label="Total do orçamento" value={`${currency} ${formatAmount(order.quote.total)}`} />
              </dl>

              <div className="mt-5 space-y-4 border-t border-neutral-200/70 pt-4">
                <ReadField label="Bill To" value={order.billToText} />
                <ReadField label="Ship To" value={order.shipToText} />
                {order.shipToNote && <ReadField label="Observação de entrega" value={order.shipToNote} />}
              </div>
            </>
          )}
        </Card>
      </div>

      <Section title={`Itens do orçamento ${order.quoteNumber}`}>
        <TableShell>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th align="right">Qtd.</Th>
                <Th align="right">Preço unit.</Th>
                <Th align="right">Total</Th>
              </tr>
            </THead>
            <TBody>
              {order.quote.items.map((item, i) => (
                <Tr key={i}>
                  <Td>
                    <p className="font-medium text-ink-900">{item.productName}</p>
                    {item.description && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{item.description}</p>
                    )}
                  </Td>
                  <Td className="tabular text-right">{item.quantity}</Td>
                  <Td className="tabular whitespace-nowrap text-right">
                    {/* Só risca o preço de tabela quando o cobrado é um desconto
                        negociado (menor). Um preço customizado maior não é
                        "especial" — é só o preço do item, sem riscado. */}
                    {item.listPrice && item.listPrice > item.unitPrice && (
                      <span className="mr-1.5 text-neutral-400 line-through">
                        {formatAmount(item.listPrice)}
                      </span>
                    )}
                    {currency} {formatAmount(item.unitPrice)}
                  </Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink-900">
                    {currency} {formatAmount(item.lineTotal)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableShell>
      </Section>

      {user?.role === 'ADMIN' && (
        <div className="mt-8 flex justify-end">
          <Button variant="ghost" className="text-brand-600" onClick={() => setDeleting(true)}>
            Excluir pedido
          </Button>
        </div>
      )}

      {deleting && (
        <ConfirmDeleteModal
          title={`Excluir pedido #${formatOrderNumber(order.orderNumber)}?`}
          description="O pedido e os documentos gerados (Invoice, Packing List, etc.) serão removidos definitivamente. O orçamento de origem não é afetado."
          isPending={deleteOrder.isPending}
          onConfirm={() => deleteOrder.mutate()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </Page>
  )
}
