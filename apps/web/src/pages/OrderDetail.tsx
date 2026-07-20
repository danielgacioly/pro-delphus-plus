import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { formatAmount, type OrderDTO, type PrepaymentMethod } from '@prodelphusplus/shared'
import { api } from '../lib/api'

async function fetchOrder(id: string) {
  const { data } = await api.get<{ order: OrderDTO }>(`/orders/${id}`)
  return data.order
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-neutral-500">{label}</h3>
      <p className="mt-0.5 whitespace-pre-line text-sm text-ink-900">{value?.trim() ? value : '—'}</p>
    </div>
  )
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  })

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<{
    purchaseOrder: string
    orderedByEmail: string
    awbNumber: string
    incoterms: string
    prepaymentBy: PrepaymentMethod
    paypalFee: string
    nfNumber: string
    nfDate: string
    exchangeRate: string
  }>>({})

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  const updateOrder = useMutation({
    mutationFn: async () => {
      const payload = {
        purchaseOrder: editForm.purchaseOrder || undefined,
        orderedByEmail: editForm.orderedByEmail || undefined,
        awbNumber: editForm.awbNumber || undefined,
        incoterms: editForm.incoterms || undefined,
        prepaymentBy: editForm.prepaymentBy,
        paypalFee: editForm.paypalFee ? Number(editForm.paypalFee) : undefined,
        nfNumber: editForm.nfNumber || undefined,
        nfDate: editForm.nfDate || undefined,
        exchangeRate: editForm.exchangeRate ? Number(editForm.exchangeRate) : undefined,
      }
      await api.patch(`/orders/${id}`, payload)
    },
    onSuccess: () => {
      invalidate()
      setEditing(false)
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
    onSuccess: invalidate,
  })

  const uploadNf = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/orders/${id}/nf-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: invalidate,
  })

  function startEdit() {
    if (!order) return
    setEditForm({
      purchaseOrder: order.purchaseOrder ?? '',
      orderedByEmail: order.orderedByEmail,
      awbNumber: order.awbNumber ?? '',
      incoterms: order.incoterms ?? '',
      prepaymentBy: order.prepaymentBy,
      paypalFee: order.paypalFee ?? '',
      nfNumber: order.nfNumber ?? '',
      nfDate: order.nfDate ? order.nfDate.slice(0, 10) : '',
      exchangeRate: order.exchangeRate ?? '',
    })
    setEditing(true)
  }

  if (isLoading) return <p className="text-neutral-400">Carregando…</p>
  if (isError || !order) return <p className="text-brand-600">Não foi possível carregar este pedido.</p>

  const currency = order.quote.currency

  return (
    <div>
      <Link to="/pedidos" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar para pedidos
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Pedido #{order.orderNumber}</h1>
          <p className="mt-1 text-neutral-500">
            A partir do orçamento{' '}
            <span className="font-medium text-ink-900">{order.quoteNumber}</span> — {order.quote.clientName}
          </p>
        </div>
        <button
          onClick={editing ? () => setEditing(false) : startEdit}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neutral-50"
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-700">Documentos gerados</h2>
          <div className="flex flex-wrap gap-2">
            {order.invoicePdfUrl && (
              <a
                href={order.invoicePdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Invoice
              </a>
            )}
            {order.packingListPdfUrl && (
              <a
                href={order.packingListPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Packing List
              </a>
            )}
            {order.packingListBoxPdfUrl && (
              <a
                href={order.packingListBoxPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Packing List Box
              </a>
            )}
            {order.exportDocXlsxUrl && (
              <a
                href={order.exportDocXlsxUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
              >
                Doc. de Exportação
              </a>
            )}
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">AWB (manual)</h3>
            {order.awbDocumentUrl ? (
              <a href={order.awbDocumentUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
                Ver arquivo enviado
              </a>
            ) : (
              <p className="text-sm text-neutral-400">Nenhum arquivo enviado.</p>
            )}
            <input
              type="file"
              className="mt-2 text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadAwb.mutate(file)
                e.target.value = ''
              }}
            />
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Nota Fiscal (manual)</h3>
            {order.nfDocumentUrl ? (
              <a href={order.nfDocumentUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
                Ver arquivo enviado
              </a>
            ) : (
              <p className="text-sm text-neutral-400">Nenhum arquivo enviado.</p>
            )}
            <input
              type="file"
              className="mt-2 text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadNf.mutate(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                updateOrder.mutate()
              }}
              className="space-y-3"
            >
              <h2 className="text-sm font-semibold text-neutral-700">Editar pedido</h2>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Purchase Order</label>
                <input
                  value={editForm.purchaseOrder}
                  onChange={(e) => setEditForm((s) => ({ ...s, purchaseOrder: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">E-mail do comprador</label>
                <input
                  type="email"
                  value={editForm.orderedByEmail}
                  onChange={(e) => setEditForm((s) => ({ ...s, orderedByEmail: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">AWB #</label>
                <input
                  value={editForm.awbNumber}
                  onChange={(e) => setEditForm((s) => ({ ...s, awbNumber: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Incoterms</label>
                <input
                  value={editForm.incoterms}
                  onChange={(e) => setEditForm((s) => ({ ...s, incoterms: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Prepayment by</label>
                  <select
                    value={editForm.prepaymentBy}
                    onChange={(e) => setEditForm((s) => ({ ...s, prepaymentBy: e.target.value as PrepaymentMethod }))}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                  >
                    <option value="WIRE_TRANSFER">Wire Transfer</option>
                    <option value="PAYPAL">PayPal</option>
                  </select>
                </div>
                {editForm.prepaymentBy === 'PAYPAL' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Taxa do PayPal</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.paypalFee}
                      onChange={(e) => setEditForm((s) => ({ ...s, paypalFee: e.target.value }))}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Número da NF</label>
                  <input
                    value={editForm.nfNumber}
                    onChange={(e) => setEditForm((s) => ({ ...s, nfNumber: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Data de emissão da NF</label>
                  <input
                    type="date"
                    value={editForm.nfDate}
                    onChange={(e) => setEditForm((s) => ({ ...s, nfDate: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Câmbio USD/BRL</label>
                <input
                  type="number"
                  step="0.0001"
                  value={editForm.exchangeRate}
                  onChange={(e) => setEditForm((s) => ({ ...s, exchangeRate: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
              <p className="text-[11px] text-neutral-400">
                Salvar regenera automaticamente o Invoice, Packing List, Packing List Box e Documento de Exportação.
              </p>
              <button
                type="submit"
                disabled={updateOrder.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {updateOrder.isPending ? 'Salvando…' : 'Salvar e regenerar documentos'}
              </button>
            </form>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-neutral-700">Dados do pedido</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Purchase Order" value={order.purchaseOrder ?? order.quoteNumber} />
                <Field label="Ordered By" value={order.orderedByEmail} />
                <Field label="Data de expedição" value={order.shipDate ? new Date(order.shipDate).toLocaleDateString('pt-BR') : null} />
                <Field label="Data do invoice" value={new Date(order.invoiceDate).toLocaleDateString('pt-BR')} />
                <Field label="Nº de pacotes" value={order.numberOfPackages} />
                <Field label="Peso líquido" value={order.netWeightKg ? `${order.netWeightKg} KG` : null} />
                <Field label="Peso bruto" value={order.grossWeightKg ? `${order.grossWeightKg} KG` : null} />
                <Field label="Incoterms" value={order.incoterms} />
                <Field label="AWB #" value={order.awbNumber} />
                <Field
                  label="Prepayment"
                  value={
                    order.prepaymentBy === 'PAYPAL'
                      ? `PayPal (taxa ${currency} ${formatAmount(order.paypalFee ?? 0)})`
                      : 'Wire Transfer'
                  }
                />
                <Field label="Número da NF" value={order.nfNumber} />
                <Field label="Data de emissão da NF" value={order.nfDate ? new Date(order.nfDate).toLocaleDateString('pt-BR') : null} />
                <Field label="Câmbio USD/BRL" value={order.exchangeRate} />
                <Field label="Total do orçamento" value={`${currency} ${formatAmount(order.quote.total)}`} />
              </div>
              <div className="border-t border-neutral-100 pt-4">
                <Field label="Bill To" value={order.billToText} />
              </div>
              <div className="border-t border-neutral-100 pt-4">
                <Field label="Ship To" value={order.shipToText} />
              </div>
              {order.shipToNote && (
                <div className="border-t border-neutral-100 pt-4">
                  <Field label="Observação de entrega" value={order.shipToNote} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Itens (do orçamento {order.quoteNumber})</h2>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead>
            <tr>
              <th className="px-3 py-1.5 text-left font-medium text-neutral-500">Item</th>
              <th className="px-3 py-1.5 text-left font-medium text-neutral-500">Qtd.</th>
              <th className="px-3 py-1.5 text-left font-medium text-neutral-500">Preço unit.</th>
              <th className="px-3 py-1.5 text-left font-medium text-neutral-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {order.quote.items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 text-ink-900">
                  <strong>{item.productName}</strong>
                  {item.description && <span className="text-neutral-500"> — {item.description}</span>}
                </td>
                <td className="px-3 py-1.5 text-neutral-600">{item.quantity}</td>
                <td className="px-3 py-1.5 text-neutral-600">
                  {currency} {formatAmount(item.unitPrice)}
                </td>
                <td className="px-3 py-1.5 text-ink-900">
                  {currency} {formatAmount(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
