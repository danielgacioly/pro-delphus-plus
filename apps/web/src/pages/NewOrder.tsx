import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatAmount, type CreateOrderInput, type OrderDTO, type PrepaymentMethod, type QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { BackLink, Button, Card, Field, FormSection, Input, Page, Select, Textarea } from '../components/ui'
import { IconPlus } from '../components/icons'

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

async function fetchExchangeRate() {
  const { data } = await api.get<{ rate: number }>('/orders/exchange-rate')
  return data.rate
}

async function fetchOrder(id: string) {
  const { data } = await api.get<{ order: OrderDTO }>(`/orders/${id}`)
  return data.order
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
  const [searchParams] = useSearchParams()
  const duplicateFrom = searchParams.get('duplicateFrom')
  const [form, setForm] = useState(emptyForm)
  const [itemWeights, setItemWeights] = useState<string[]>([])
  const [packageCount, setPackageCount] = useState('1')
  const [boxLines, setBoxLines] = useState<BoxLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const prefilled = useRef(false)

  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: liveRate } = useQuery({ queryKey: ['exchange-rate'], queryFn: fetchExchangeRate })
  const { data: sourceOrder } = useQuery({
    queryKey: ['orders', duplicateFrom],
    queryFn: () => fetchOrder(duplicateFrom as string),
    enabled: !!duplicateFrom,
  })

  useEffect(() => {
    if (liveRate && !form.exchangeRate) {
      setForm((s) => ({ ...s, exchangeRate: String(liveRate) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRate])

  // Pre-fill the form from a previous order once both it and the quotes list
  // have loaded — guarded so it only runs once, and never overwrites fields
  // that are inherently unique per shipment (PO, ship date, AWB, NF, rate).
  useEffect(() => {
    if (!sourceOrder || !quotes || prefilled.current) return
    prefilled.current = true
    const quote = quotes.find((q) => q.id === sourceOrder.quoteId)
    setForm((s) => ({
      ...s,
      quoteId: sourceOrder.quoteId,
      orderedByEmail: sourceOrder.orderedByEmail,
      billToText: sourceOrder.billToText,
      shipToText: sourceOrder.shipToText,
      shipToNote: sourceOrder.shipToNote ?? '',
      netWeightKg: sourceOrder.netWeightKg ?? '',
      grossWeightKg: sourceOrder.grossWeightKg ?? '',
      incoterms: sourceOrder.incoterms ?? '',
      prepaymentBy: sourceOrder.prepaymentBy,
      paypalFee: sourceOrder.paypalFee ?? '',
    }))
    setPackageCount(String(sourceOrder.packageCount || 1))
    setItemWeights(
      sourceOrder.itemWeightsKg && quote
        ? quote.items.map((_, i) => {
            const w = sourceOrder.itemWeightsKg?.[i]
            return w != null ? String(w) : ''
          })
        : quote
          ? quote.items.map(() => '')
          : [],
    )
    if (sourceOrder.boxAssignments && quote) {
      const lines: BoxLine[] = []
      sourceOrder.boxAssignments.forEach((box, boxIndex) => {
        box.forEach((entry, i) => {
          lines.push({ id: `dup-${boxIndex}-${i}`, label: entry.label, quantity: entry.quantity, box: boxIndex + 1 })
        })
      })
      setBoxLines(lines)
    } else if (quote) {
      setBoxLines(quote.items.map((item, i) => ({ id: `item-${i}`, label: item.productName, quantity: item.quantity, box: 1 })))
    }
  }, [sourceOrder, quotes])

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

  const boxCount = Math.max(1, Number(packageCount) || 1)

  return (
    <Page
      title="Novo pedido"
      description="Selecione um orçamento já gerado para criar o Invoice, Packing List, Packing List Box e Documento de Exportação."
      width="narrow"
    >
      <div className="-mt-4 mb-5">
        <BackLink to="/pedidos">Pedidos</BackLink>
      </div>

      {duplicateFrom && (
        <div className="animate-fade-in mb-4 rounded-xl bg-amber-500/12 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          {sourceOrder
            ? `Campos preenchidos a partir do pedido #${sourceOrder.orderNumber}. Purchase Order, data de expedição, AWB, NF e câmbio ficaram em branco — revise antes de criar.`
            : 'Carregando dados do pedido a duplicar…'}
        </div>
      )}

      {error && (
        <div className="animate-fade-in mb-4 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{error}</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createOrder.mutate()
        }}
      >
        <Card className="space-y-7 p-6">
          <FormSection title="Orçamento de origem">
            <Field label="Orçamento" hint={currency ? `Moeda do orçamento: ${currency}` : undefined}>
              <Select required value={form.quoteId} onChange={(e) => selectQuote(e.target.value)}>
                <option value="">Selecione um orçamento…</option>
                {quotes?.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber} — {q.clientName} — {q.currency} {formatAmount(q.total)}
                  </option>
                ))}
              </Select>
            </Field>
          </FormSection>

          <FormSection title="Comprador">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Purchase Order (opcional)" hint="Se vazio, usa o número do orçamento.">
                <Input value={form.purchaseOrder} onChange={(e) => update({ purchaseOrder: e.target.value })} />
              </Field>
              <Field label="E-mail do comprador (Ordered By)">
                <Input
                  type="email"
                  required
                  value={form.orderedByEmail}
                  onChange={(e) => update({ orderedByEmail: e.target.value })}
                />
              </Field>
              <Field label="Data de expedição (opcional)">
                <Input type="date" value={form.shipDate} onChange={(e) => update({ shipDate: e.target.value })} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Endereços">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Bill To">
                <Textarea
                  required
                  rows={5}
                  placeholder={'Attn: Nome\nEndereço\nCidade, Estado. País.\nCEP\nMail: ...\nTel: ...'}
                  value={form.billToText}
                  onChange={(e) => update({ billToText: e.target.value })}
                />
              </Field>
              <Field label="Ship To">
                <Textarea
                  required
                  rows={5}
                  placeholder={'Attn: Nome - Empresa\nEndereço de entrega\n...'}
                  value={form.shipToText}
                  onChange={(e) => update({ shipToText: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Observação de entrega (opcional)"
              hint='ex: "HOLD FOR PICKUP – CUSTOMER WILL COLLECT AT DHL OFFICE"'
              className="mt-4"
            >
              <Input value={form.shipToNote} onChange={(e) => update({ shipToNote: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Embalagem e pesos">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Peso líquido (kg)">
                <Input
                  type="number"
                  step="0.001"
                  className="tabular"
                  value={form.netWeightKg}
                  onChange={(e) => update({ netWeightKg: e.target.value })}
                />
              </Field>
              <Field label="Peso bruto (kg)">
                <Input
                  type="number"
                  step="0.001"
                  className="tabular"
                  value={form.grossWeightKg}
                  onChange={(e) => update({ grossWeightKg: e.target.value })}
                />
              </Field>
              <Field label="Incoterms">
                <Input
                  placeholder="ex: DAP MONTERREY"
                  value={form.incoterms}
                  onChange={(e) => update({ incoterms: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Número de caixas"
              hint='Preenche "Number of Packages" no invoice e gera uma página do Packing List Box por caixa.'
              className="mt-4 w-40"
            >
              <Input
                type="number"
                min={1}
                className="tabular"
                value={packageCount}
                onChange={(e) => updatePackageCount(e.target.value)}
              />
            </Field>

            {selectedQuote && selectedQuote.items.length > 0 && (
              <div className="mt-5 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h3 className="text-eyebrow text-neutral-500">Itens por caixa</h3>
                  <Button type="button" size="sm" onClick={addCustomBoxLine}>
                    <IconPlus className="h-3.5 w-3.5" />
                    Item customizado
                  </Button>
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
                  Cada item vai para uma única caixa. Se um modelo completo precisar ser dividido entre caixas, use
                  “dividir” para desmembrar a linha em partes que podem ser renomeadas e realocadas.
                </p>

                <div className="space-y-2">
                  {boxLines.map((line) => (
                    <div key={line.id} className="flex flex-wrap items-center gap-2">
                      <Input
                        value={line.label}
                        placeholder="Nome do item ou componente"
                        onChange={(e) => updateBoxLine(line.id, { label: e.target.value })}
                        className="h-9 min-w-48 flex-1 text-[13px]"
                      />
                      <Input
                        type="number"
                        min={1}
                        aria-label="Quantidade"
                        value={line.quantity}
                        onChange={(e) => updateBoxLine(line.id, { quantity: Number(e.target.value) || 1 })}
                        className="tabular h-9 w-16 shrink-0 text-center text-[13px]"
                      />
                      <Select
                        auto
                        aria-label="Caixa"
                        value={line.box}
                        onChange={(e) => updateBoxLine(line.id, { box: Number(e.target.value) })}
                        className="h-9 text-[13px]"
                      >
                        {Array.from({ length: boxCount }, (_, i) => i + 1).map((b) => (
                          <option key={b} value={b}>
                            Caixa {b}
                          </option>
                        ))}
                      </Select>
                      <Button type="button" size="sm" onClick={() => splitBoxLine(line.id)}>
                        Dividir
                      </Button>
                      <button
                        type="button"
                        onClick={() => removeBoxLine(line.id)}
                        aria-label="Remover linha"
                        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-brand-50 hover:text-brand-600 active:scale-90"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedQuote && selectedQuote.items.length > 0 && (
              <div className="mt-4 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
                <h3 className="text-eyebrow mb-1.5 text-neutral-500">Peso por item</h3>
                <p className="mb-3 text-[12px] text-neutral-500">Em kg por unidade — usado no Documento de Exportação.</p>
                <div className="space-y-2">
                  {selectedQuote.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-600">
                        {item.productName}
                        {item.description && <span className="text-neutral-400"> — {item.description}</span>}
                      </span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="kg/un."
                        aria-label={`Peso de ${item.productName}`}
                        value={itemWeights[index] ?? ''}
                        onChange={(e) => updateItemWeight(index, e.target.value)}
                        className="tabular h-9 w-28 shrink-0 text-[13px]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FormSection>

          <FormSection title="Pagamento e transporte">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="AWB #">
                <Input value={form.awbNumber} onChange={(e) => update({ awbNumber: e.target.value })} />
              </Field>
              <Field label="Prepayment by">
                <Select
                  value={form.prepaymentBy}
                  onChange={(e) => update({ prepaymentBy: e.target.value as PrepaymentMethod })}
                >
                  <option value="WIRE_TRANSFER">Wire Transfer</option>
                  <option value="PAYPAL">PayPal</option>
                </Select>
              </Field>
              {form.prepaymentBy === 'PAYPAL' && (
                <Field label="Taxa do PayPal">
                  <Input
                    type="number"
                    step="0.01"
                    className="tabular"
                    value={form.paypalFee}
                    onChange={(e) => update({ paypalFee: e.target.value })}
                  />
                </Field>
              )}
              <Field label="Câmbio USD/BRL" hint={liveRate ? `Hoje: ${liveRate}` : undefined}>
                <Input
                  type="number"
                  step="0.0001"
                  className="tabular"
                  value={form.exchangeRate}
                  onChange={(e) => update({ exchangeRate: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Nota fiscal" description="Opcional — pode preencher depois no detalhe do pedido.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Número da NF">
                <Input value={form.nfNumber} onChange={(e) => update({ nfNumber: e.target.value })} />
              </Field>
              <Field label="Data de emissão">
                <Input type="date" value={form.nfDate} onChange={(e) => update({ nfDate: e.target.value })} />
              </Field>
            </div>
          </FormSection>
        </Card>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={() => navigate('/pedidos')}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={createOrder.isPending}>
            {createOrder.isPending ? 'Gerando documentos…' : 'Criar pedido e gerar documentos'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
