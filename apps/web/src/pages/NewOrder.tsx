import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatAmount, type CreateOrderInput, type OrderDTO, type PrepaymentMethod, type QuoteDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { useBoxAssignmentEditor } from '../hooks/useBoxAssignmentEditor'
import { BoxAssignmentFields } from '../components/BoxAssignmentFields'
import { BackLink, Button, Card, Field, FormSection, Input, Page, Select, Textarea } from '../components/ui'

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

export function NewOrder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const duplicateFrom = searchParams.get('duplicateFrom')
  const [form, setForm] = useState(emptyForm)
  const boxEditor = useBoxAssignmentEditor()
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
    boxEditor.loadExisting({
      items: quote?.items ?? [],
      packageCount: sourceOrder.packageCount || 1,
      itemWeightsKg: sourceOrder.itemWeightsKg,
      boxAssignments: sourceOrder.boxAssignments,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceOrder, quotes])

  const selectedQuote = quotes?.find((q) => q.id === form.quoteId)
  const currency = selectedQuote?.currency ?? null

  function update(patch: Partial<typeof form>) {
    setForm((s) => ({ ...s, ...patch }))
  }

  function selectQuote(quoteId: string) {
    const quote = quotes?.find((q) => q.id === quoteId)
    update({ quoteId })
    boxEditor.resetFromItems(quote?.items)
  }

  const createOrder = useMutation({
    mutationFn: async () => {
      const { itemWeightsKg, packageCount, boxAssignments } = boxEditor.buildPayload()
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
        itemWeightsKg,
        packageCount,
        boxAssignments,
      }
      const { data } = await api.post<{ order: OrderDTO }>('/orders', payload)
      return data.order
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Pedido criado.')
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

            <BoxAssignmentFields editor={boxEditor} items={selectedQuote?.items ?? []} />
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
                  required
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
