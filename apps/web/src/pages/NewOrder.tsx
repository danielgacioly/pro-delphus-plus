import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { formatAmount, type CreateOrderInput, type OrderDTO, type PrepaymentMethod, type QuoteDTO } from '@prodelphusplus/shared'
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

interface BoxLine {
  id: string
  label: string
  quantity: number
  box: number
}

export function NewOrder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [itemWeights, setItemWeights] = useState<string[]>([])
  const [packageCount, setPackageCount] = useState('1')
  const [boxLines, setBoxLines] = useState<BoxLine[]>([])
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
  const currency = selectedQuote?.currency ?? null

  function update(patch: Partial<typeof form>) {
    setForm((s) => ({ ...s, ...patch }))
  }

  function selectQuote(quoteId: string) {
    const quote = quotes?.find((q) => q.id === quoteId)
    update({ quoteId })
    setItemWeights(quote ? quote.items.map(() => '') : [])
    setPackageCount('1')
    // One line per quote item, all in box 1 by default — an item can never
    // silently end up in two boxes; splitting is an explicit user action.
    setBoxLines(
      quote ? quote.items.map((item, i) => ({ id: `item-${i}`, label: item.productName, quantity: item.quantity, box: 1 })) : [],
    )
  }

  function updateItemWeight(index: number, value: string) {
    setItemWeights((prev) => prev.map((w, i) => (i === index ? value : w)))
  }

  function updatePackageCount(value: string) {
    setPackageCount(value)
    const count = Math.max(1, Number(value) || 1)
    setBoxLines((prev) => prev.map((l) => (l.box > count ? { ...l, box: count } : l)))
  }

  function updateBoxLine(id: string, patch: Partial<BoxLine>) {
    setBoxLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function splitBoxLine(id: string) {
    setBoxLines((prev) => {
      const index = prev.findIndex((l) => l.id === id)
      if (index === -1) return prev
      const line = prev[index]
      const half = Math.max(1, Math.floor(line.quantity / 2))
      const rest = Math.max(1, line.quantity - half)
      const newLine: BoxLine = { id: `${id}-split-${Date.now()}`, label: line.label, quantity: half, box: line.box }
      const next = [...prev]
      next[index] = { ...line, quantity: rest }
      next.splice(index + 1, 0, newLine)
      return next
    })
  }

  function addCustomBoxLine() {
    setBoxLines((prev) => [...prev, { id: `custom-${Date.now()}`, label: '', quantity: 1, box: 1 }])
  }

  function removeBoxLine(id: string) {
    setBoxLines((prev) => prev.filter((l) => l.id !== id))
  }

  const createOrder = useMutation({
    mutationFn: async () => {
      const count = Math.max(1, Number(packageCount) || 1)
      const boxAssignments = boxLines.length
        ? Array.from({ length: count }, (_, boxIndex) =>
            boxLines
              .filter((l) => l.box === boxIndex + 1 && l.label.trim() && l.quantity > 0)
              .map((l) => ({ label: l.label.trim(), quantity: l.quantity })),
          )
        : undefined
      const payload: CreateOrderInput = {
        quoteId: form.quoteId,
        purchaseOrder: form.purchaseOrder || undefined,
        orderedByEmail: form.orderedByEmail,
        shipDate: form.shipDate || undefined,
        billToText: form.billToText,
        shipToText: form.shipToText,
        shipToNote: form.shipToNote || undefined,
        netWeightKg: form.netWeightKg ? Number(form.netWeightKg) : undefined,
        grossWeightKg: form.grossWeightKg ? Number(form.grossWeightKg) : undefined,
        awbNumber: form.awbNumber || undefined,
        incoterms: form.incoterms || undefined,
        prepaymentBy: form.prepaymentBy,
        paypalFee: form.prepaymentBy === 'PAYPAL' && form.paypalFee ? Number(form.paypalFee) : undefined,
        nfNumber: form.nfNumber || undefined,
        nfDate: form.nfDate || undefined,
        exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : undefined,
        itemWeightsKg: itemWeights.some((w) => w)
          ? itemWeights.map((w) => (w ? Number(w) : null))
          : undefined,
        packageCount: count,
        boxAssignments,
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
            onChange={(e) => selectQuote(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione um orçamento…</option>
            {quotes?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quoteNumber} — {q.clientName} — {q.currency} {formatAmount(q.total)}
              </option>
            ))}
          </select>
          {currency && <p className="mt-1 text-[11px] text-neutral-400">Moeda do orçamento: {currency}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Purchase Order (opcional)</label>
            <input
              value={form.purchaseOrder}
              onChange={(e) => update({ purchaseOrder: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-neutral-400">Se vazio, usa o número do orçamento.</p>
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

        <div className="grid grid-cols-3 gap-3">
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
          <label className="mb-1 block text-xs font-medium text-neutral-600">Número de caixas</label>
          <input
            type="number"
            min={1}
            value={packageCount}
            onChange={(e) => updatePackageCount(e.target.value)}
            className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Preenche "Number of Packages" no invoice/packing list automaticamente (ex: 02 Cartons) e gera uma página
            do Packing List Box por caixa.
          </p>
        </div>

        {selectedQuote && selectedQuote.items.length > 0 && (
          <div className="rounded-lg border border-neutral-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-medium text-neutral-600">
                Itens por caixa (Packing List Box)
              </label>
              <button
                type="button"
                onClick={addCustomBoxLine}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                + item customizado
              </button>
            </div>
            <p className="mb-2 text-[11px] text-neutral-400">
              Cada item vai para uma única caixa. Se um modelo completo precisar ser dividido em componentes entre
              caixas, use "dividir" para desmembrar a linha em partes que podem ser renomeadas e realocadas
              livremente.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-neutral-500">Item</th>
                    <th className="px-2 py-1 text-left font-medium text-neutral-500">Qtd.</th>
                    <th className="px-2 py-1 text-left font-medium text-neutral-500">Caixa</th>
                    <th className="px-2 py-1 text-left font-medium text-neutral-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {boxLines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-2 py-1">
                        <input
                          value={line.label}
                          placeholder="Nome do item ou componente"
                          onChange={(e) => updateBoxLine(line.id, { label: e.target.value })}
                          className="w-56 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateBoxLine(line.id, { quantity: Number(e.target.value) || 1 })}
                          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={line.box}
                          onChange={(e) => updateBoxLine(line.id, { box: Number(e.target.value) })}
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                        >
                          {Array.from({ length: Math.max(1, Number(packageCount) || 1) }, (_, i) => i + 1).map((b) => (
                            <option key={b} value={b}>
                              Caixa {b}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => splitBoxLine(line.id)}
                          className="mr-2 text-brand-600 hover:underline"
                        >
                          dividir
                        </button>
                        <button type="button" onClick={() => removeBoxLine(line.id)} className="text-neutral-400 hover:underline">
                          remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedQuote && selectedQuote.items.length > 0 && (
          <div className="rounded-lg border border-neutral-200 p-3">
            <label className="mb-2 block text-xs font-medium text-neutral-600">
              Peso por item (kg) — usado no Documento de Exportação
            </label>
            <div className="space-y-2">
              {selectedQuote.items.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="flex-1 text-xs text-neutral-600">
                    {item.productName}
                    {item.description && <span className="text-neutral-400"> — {item.description}</span>}
                  </span>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="kg/un."
                    value={itemWeights[index] ?? ''}
                    onChange={(e) => updateItemWeight(index, e.target.value)}
                    className="w-28 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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
