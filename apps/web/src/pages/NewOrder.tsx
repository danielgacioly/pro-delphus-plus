import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import type { CreateOrderInput, OrderDTO, PrepaymentMethod, QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

async function fetchExchangeRate() {
  const { data } = await api.get<{ rate: number }>('/orders/exchange-rate')
  return data.rate
}

const emptyForm = {
  quoteId: '',
  purchaseOrder: '',
  orderedByEmail: '',
  shipDate: '',
  billToText: '',
  shipToText: '',
  shipToNote: '',
  numberOfPackages: '',
  netWeightKg: '',
  grossWeightKg: '',
  awbNumber: '',
  incoterms: '',
  prepaymentBy: 'WIRE_TRANSFER' as PrepaymentMethod,
  paypalFee: '',
  nfNumber: '',
  nfDate: '',
  exchangeRate: '',
}

export function NewOrder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: liveRate } = useQuery({ queryKey: ['exchange-rate'], queryFn: fetchExchangeRate })

  useEffect(() => {
    if (liveRate && !form.exchangeRate) {
      setForm((s) => ({ ...s, exchangeRate: String(liveRate) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRate])

  const selectedQuote = quotes?.find((q) => q.id === form.quoteId)
  const currency = selectedQuote ? (selectedQuote.language === 'PT' ? 'BRL' : 'USD') : null

  function update(patch: Partial<typeof form>) {
    setForm((s) => ({ ...s, ...patch }))
  }

  const createOrder = useMutation({
    mutationFn: async () => {
      const payload: CreateOrderInput = {
        quoteId: form.quoteId,
        purchaseOrder: form.purchaseOrder || undefined,
        orderedByEmail: form.orderedByEmail,
        shipDate: form.shipDate || undefined,
        billToText: form.billToText,
        shipToText: form.shipToText,
        shipToNote: form.shipToNote || undefined,
        numberOfPackages: form.numberOfPackages || undefined,
        netWeightKg: form.netWeightKg ? Number(form.netWeightKg) : undefined,
        grossWeightKg: form.grossWeightKg ? Number(form.grossWeightKg) : undefined,
        awbNumber: form.awbNumber || undefined,
        incoterms: form.incoterms || undefined,
        prepaymentBy: form.prepaymentBy,
        paypalFee: form.prepaymentBy === 'PAYPAL' && form.paypalFee ? Number(form.paypalFee) : undefined,
        nfNumber: form.nfNumber || undefined,
        nfDate: form.nfDate || undefined,
        exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : undefined,
      }
      const { data } = await api.post<{ order: OrderDTO }>('/orders', payload)
      return data.order
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/pedidos/${order.id}`)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível criar o pedido.'
      setError(message)
    },
  })

  return (
    <div>
      <Link to="/pedidos" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar para pedidos
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink-900">Novo pedido</h1>
      <p className="mt-1 text-neutral-500">
        Selecione um orçamento já gerado para criar o Invoice, Packing List, Packing List Box e Documento de
        Exportação.
      </p>

      {error && (
        <div className="mt-4 max-w-3xl rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createOrder.mutate()
        }}
        className="mt-4 max-w-3xl space-y-4 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Orçamento</label>
          <select
            required
            value={form.quoteId}
            onChange={(e) => update({ quoteId: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione um orçamento…</option>
            {quotes?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quoteNumber} — {q.clientName} — {q.language === 'PT' ? 'BRL' : 'USD'} {Number(q.total).toFixed(2)}
              </option>
            ))}
          </select>
          {currency && <p className="mt-1 text-[11px] text-neutral-400">Moeda do orçamento: {currency}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Purchase Order (opcional — se vazio, usa o número do orçamento)
            </label>
            <input
              value={form.purchaseOrder}
              onChange={(e) => update({ purchaseOrder: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">E-mail do comprador (Ordered By)</label>
            <input
              type="email"
              required
              value={form.orderedByEmail}
              onChange={(e) => update({ orderedByEmail: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Data de expedição (opcional)</label>
          <input
            type="date"
            value={form.shipDate}
            onChange={(e) => update({ shipDate: e.target.value })}
            className="w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Bill To</label>
            <textarea
              required
              rows={5}
              placeholder={'Attn: Nome\nEndereço\nCidade, Estado. País.\nCEP\nMail: ...\nTel: ...'}
              value={form.billToText}
              onChange={(e) => update({ billToText: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Ship To</label>
            <textarea
              required
              rows={5}
              placeholder={'Attn: Nome - Empresa\nEndereço de entrega\n...'}
              value={form.shipToText}
              onChange={(e) => update({ shipToText: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Observação de entrega (opcional — ex: "HOLD FOR PICKUP – CUSTOMER WILL COLLECT AT DHL OFFICE")
          </label>
          <input
            value={form.shipToNote}
            onChange={(e) => update({ shipToNote: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Nº de pacotes</label>
            <input
              placeholder="ex: 01 Carton"
              value={form.numberOfPackages}
              onChange={(e) => update({ numberOfPackages: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Peso líquido (kg)</label>
            <input
              type="number"
              step="0.001"
              value={form.netWeightKg}
              onChange={(e) => update({ netWeightKg: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Peso bruto (kg)</label>
            <input
              type="number"
              step="0.001"
              value={form.grossWeightKg}
              onChange={(e) => update({ grossWeightKg: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Incoterms</label>
            <input
              placeholder="ex: DAP MONTERREY"
              value={form.incoterms}
              onChange={(e) => update({ incoterms: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">AWB #</label>
          <input
            value={form.awbNumber}
            onChange={(e) => update({ awbNumber: e.target.value })}
            className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Prepayment by</label>
            <select
              value={form.prepaymentBy}
              onChange={(e) => update({ prepaymentBy: e.target.value as PrepaymentMethod })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="WIRE_TRANSFER">Wire Transfer</option>
              <option value="PAYPAL">PayPal</option>
            </select>
          </div>
          {form.prepaymentBy === 'PAYPAL' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Taxa do PayPal</label>
              <input
                type="number"
                step="0.01"
                value={form.paypalFee}
                onChange={(e) => update({ paypalFee: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Câmbio USD/BRL {liveRate ? `(hoje: ${liveRate})` : ''}
            </label>
            <input
              type="number"
              step="0.0001"
              value={form.exchangeRate}
              onChange={(e) => update({ exchangeRate: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Número da Nota Fiscal (opcional — pode preencher depois)
            </label>
            <input
              value={form.nfNumber}
              onChange={(e) => update({ nfNumber: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Data de emissão da NF</label>
            <input
              type="date"
              value={form.nfDate}
              onChange={(e) => update({ nfDate: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={createOrder.isPending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {createOrder.isPending ? 'Gerando documentos…' : 'Criar pedido e gerar documentos'}
        </button>
      </form>
    </div>
  )
}
