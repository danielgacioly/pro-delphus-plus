import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatAmount, formatOrderNumber, type CreateOrderInput, type OrderDTO, type PrepaymentMethod, type QuoteDTO } from '@prodelphusplus/shared'
import { api, getErrorMessage } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { useBoxAssignmentEditor } from '../hooks/useBoxAssignmentEditor'
import { BoxAssignmentFields } from '../components/BoxAssignmentFields'
import { AddressFields, BuyerFields, InvoiceFields, WeightFields } from '../components/OrderFormFields'
import { Alert, Button, Card, Field, FormSection, Input, Page, Select } from '../components/ui'

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

async function fetchExchangeRate(currency: 'USD' | 'EUR') {
  const { data } = await api.get<{ rate: number }>('/orders/exchange-rate', { params: { currency } })
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
  shippingMethod: '',
  creditCardPaymentLink: '',
  prepaymentBy: 'WIRE_TRANSFER' as PrepaymentMethod,
  paypalFee: '',
  nfNumber: '',
  nfDate: '',
  exchangeRate: '',
}

/**
 * Criar e editar pedido são a mesma tela — como em NewQuote. Editar um pedido
 * é preencher os mesmos campos com outros valores; ter um formulário à parte
 * (antes espremido num card do detalhe) só fazia as duas telas divergirem.
 */
export function NewOrder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const { id: editId } = useParams<{ id: string }>()
  const isEditing = !!editId
  const duplicateFrom = searchParams.get('duplicateFrom')
  // Duplicar e editar partem do mesmo lugar: um pedido que já existe. A
  // diferença é o quanto se copia dele (ver o efeito de pré-preenchimento).
  const sourceOrderId = editId ?? duplicateFrom
  const [form, setForm] = useState(emptyForm)
  const boxEditor = useBoxAssignmentEditor()
  const [error, setError] = useState<string | null>(null)
  const prefilled = useRef(false)

  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const { data: sourceOrder, isLoading: loadingSourceOrder } = useQuery({
    queryKey: ['order', sourceOrderId],
    queryFn: () => fetchOrder(sourceOrderId as string),
    enabled: !!sourceOrderId,
  })

  const selectedQuote = quotes?.find((q) => q.id === form.quoteId)
  const currency = selectedQuote?.currency ?? null
  // Venda nacional não sai do Brasil — sem câmbio, Incoterms, AWB nem
  // Documento de Exportação (Invoice e Packing List Box continuam saindo).
  // Ver a mesma regra em apps/api/src/routes/orders.routes.ts.
  const isNational = selectedQuote?.exportScope === 'NATIONAL'
  const rateCurrency = currency === 'EUR' ? 'EUR' : 'USD'

  const { data: liveRate } = useQuery({
    queryKey: ['exchange-rate', rateCurrency],
    queryFn: () => fetchExchangeRate(rateCurrency),
    enabled: !isNational,
  })

  useEffect(() => {
    // Editando, o câmbio vem do pedido salvo — só preenche com a cotação de
    // hoje depois que o pré-preenchimento rodou, pra não sobrescrever o valor
    // com que os documentos foram gerados.
    if (isEditing && !prefilled.current) return
    if (liveRate && !form.exchangeRate) {
      setForm((s) => ({ ...s, exchangeRate: String(liveRate) }))
    }
    // Depende também de quoteId: selectQuote sempre zera exchangeRate ao
    // trocar de orçamento, mas quando a moeda do novo orçamento é a mesma do
    // anterior (ex: USD → USD) a query de câmbio não recarrega — sem essa
    // dependência o campo ficava vazio pra sempre nesse caso, já que só
    // reagia a mudanças em `liveRate`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRate, form.quoteId])

  // Pré-preenche o formulário a partir de um pedido existente assim que ele e
  // a lista de orçamentos carregam, uma única vez. Ao duplicar, os campos que
  // são únicos de cada remessa (pedido de compra, data de expedição, AWB, NF e
  // câmbio) ficam em branco; ao editar, o pedido é carregado inteiro.
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
      shippingMethod: sourceOrder.shippingMethod ?? '',
      creditCardPaymentLink: sourceOrder.creditCardPaymentLink ?? '',
      prepaymentBy: sourceOrder.prepaymentBy,
      paypalFee: sourceOrder.paypalFee ?? '',
      ...(isEditing
        ? {
            purchaseOrder: sourceOrder.purchaseOrder ?? '',
            shipDate: sourceOrder.shipDate ? sourceOrder.shipDate.slice(0, 10) : '',
            awbNumber: sourceOrder.awbNumber ?? '',
            nfNumber: sourceOrder.nfNumber ?? '',
            nfDate: sourceOrder.nfDate ? sourceOrder.nfDate.slice(0, 10) : '',
            exchangeRate: sourceOrder.exchangeRate ?? '',
          }
        : {}),
    }))
    boxEditor.loadExisting({
      items: quote?.items ?? [],
      packageCount: sourceOrder.packageCount || 1,
      itemWeightsKg: sourceOrder.itemWeightsKg,
      boxAssignments: sourceOrder.boxAssignments,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceOrder, quotes])

  function update(patch: Partial<typeof form>) {
    setForm((s) => ({ ...s, ...patch }))
  }

  function selectQuote(quoteId: string) {
    const quote = quotes?.find((q) => q.id === quoteId)
    const national = quote?.exportScope === 'NATIONAL'
    // PayPal só existe pra internacional, Pix só pra nacional — trocar de
    // orçamento pode deixar a forma de pagamento já escolhida inválida.
    const invalidPrepayment = (national && form.prepaymentBy === 'PAYPAL') || (!national && form.prepaymentBy === 'PIX')
    // Limpa o câmbio ao trocar de orçamento — o valor buscado automaticamente
    // é sempre da moeda do orçamento anterior; sem isso, trocar de USD pra
    // EUR (ou vice-versa) deixava o câmbio errado preenchido sem aviso, já
    // que o efeito abaixo só preenche quando o campo está vazio.
    update({
      quoteId,
      exchangeRate: '',
      ...(invalidPrepayment ? { prepaymentBy: 'WIRE_TRANSFER' as PrepaymentMethod } : {}),
    })
    boxEditor.resetFromItems(quote?.items)
  }

  // Criando, campo de texto em branco simplesmente não vai no POST. Editando,
  // o PATCH distingue string vazia (apaga o valor salvo) de ausente (mantém) —
  // sem isso, limpar o AWB ou o número da NF na tela não limpava nada.
  const optionalText = (value: string) => (isEditing ? value : value || undefined)

  const saveOrder = useMutation({
    mutationFn: async () => {
      const { itemWeightsKg, packageCount, boxAssignments } = boxEditor.buildPayload()
      const payload: CreateOrderInput = {
        quoteId: form.quoteId,
        purchaseOrder: optionalText(form.purchaseOrder),
        orderedByEmail: form.orderedByEmail,
        shipDate: form.shipDate || undefined,
        billToText: form.billToText,
        shipToText: form.shipToText,
        shipToNote: optionalText(form.shipToNote),
        netWeightKg: form.netWeightKg ? Number(form.netWeightKg) : undefined,
        grossWeightKg: form.grossWeightKg ? Number(form.grossWeightKg) : undefined,
        awbNumber: optionalText(form.awbNumber),
        incoterms: optionalText(form.incoterms),
        shippingMethod: optionalText(form.shippingMethod),
        creditCardPaymentLink: optionalText(form.creditCardPaymentLink),
        prepaymentBy: form.prepaymentBy,
        paypalFee: form.prepaymentBy === 'PAYPAL' && form.paypalFee ? Number(form.paypalFee) : undefined,
        nfNumber: optionalText(form.nfNumber),
        nfDate: form.nfDate || undefined,
        exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : undefined,
        itemWeightsKg,
        packageCount,
        boxAssignments,
      }
      if (isEditing) {
        // O orçamento de origem não muda depois que o pedido existe — a API
        // nem aceita quoteId no PATCH.
        const { quoteId: _quoteId, ...patch } = payload
        const { data } = await api.patch<{ order: OrderDTO }>(`/orders/${editId}`, patch)
        return data.order
      }
      const { data } = await api.post<{ order: OrderDTO }>('/orders', payload)
      return data.order
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ['order', editId] })
        toast.success('Pedido atualizado.')
      } else {
        toast.success('Pedido criado.')
      }
      navigate(`/pedidos/${order.id}`)
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, isEditing ? 'Não foi possível salvar o pedido.' : 'Não foi possível criar o pedido.'))
    },
  })

  const documentsNote = isNational
    ? 'Salvar regenera automaticamente a Packing List Box.'
    : 'Salvar regenera automaticamente o Invoice, Packing List, Packing List Box e Documento de Exportação.'

  if (isEditing && loadingSourceOrder) {
    return (
      <Page back={{ to: '/pedidos', label: 'Pedidos' }} title="Editar pedido" width="narrow">
        <p className="text-[13px] text-neutral-600">Carregando pedido…</p>
      </Page>
    )
  }

  return (
    <Page
      back={isEditing ? { to: `/pedidos/${editId}`, label: 'Pedido' } : { to: '/pedidos', label: 'Pedidos' }}
      title={isEditing ? `Editar pedido #${sourceOrder ? formatOrderNumber(sourceOrder.orderNumber) : ''}` : 'Novo pedido'}
      description={
        isEditing
          ? 'Altera os dados do pedido e regenera os documentos automaticamente.'
          : isNational
            ? 'Selecione um orçamento já gerado para criar a Packing List Box.'
            : 'Selecione um orçamento já gerado para criar o Invoice, Packing List, Packing List Box e Documento de Exportação.'
      }
    >

      {duplicateFrom && (
        <div className="mb-4">
          <Alert tone="warning">
            {sourceOrder
              ? `Campos preenchidos a partir do pedido #${formatOrderNumber(sourceOrder.orderNumber)}. Purchase Order, data de expedição, AWB, NF e câmbio ficaram em branco — revise antes de criar.`
              : 'Carregando dados do pedido a duplicar…'}
          </Alert>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          saveOrder.mutate()
        }}
      >
        {/* Grade de 2 colunas a partir de xl, com o cartão principal (comprador,
            endereços, embalagem) ocupando as duas linhas da esquerda: os
            cartões da direita esticam até a altura dele e as colunas terminam
            alinhadas, sem vazio de um dos lados. Criando, no celular o
            orçamento de origem volta a ser o primeiro bloco (é a primeira
            escolha); editando não, ele já está travado. */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_1fr]">
          <Card className="space-y-7 p-6 xl:col-start-1 xl:row-span-2 xl:row-start-1">
              <FormSection title="Comprador">
                <BuyerFields value={form} onChange={update} />
              </FormSection>

              <FormSection title="Embalagem e pesos">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <WeightFields value={form} onChange={update} />
                  {isNational ? (
                    <Field label="Via de envio" hint='ex: "PAC", "SEDEX", "Transportadora XPTO"'>
                      <Input
                        placeholder="ex: SEDEX"
                        value={form.shippingMethod}
                        onChange={(e) => update({ shippingMethod: e.target.value })}
                      />
                    </Field>
                  ) : (
                    <Field label="Incoterms">
                      <Input
                        placeholder="ex: DAP MONTERREY"
                        value={form.incoterms}
                        onChange={(e) => update({ incoterms: e.target.value })}
                      />
                    </Field>
                  )}
                </div>

                <BoxAssignmentFields editor={boxEditor} items={selectedQuote?.items ?? []} />
              </FormSection>

              <FormSection title="Pagamento e transporte">
                <div className={`grid grid-cols-1 gap-4 ${isNational ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                  {!isNational && (
                    <Field label="AWB #">
                      <Input value={form.awbNumber} onChange={(e) => update({ awbNumber: e.target.value })} />
                    </Field>
                  )}
                  <Field label="Forma de pagamento">
                    <Select
                      value={form.prepaymentBy}
                      onChange={(e) => update({ prepaymentBy: e.target.value as PrepaymentMethod })}
                    >
                      <option value="WIRE_TRANSFER">Transferência bancária</option>
                      {isNational ? (
                        <option value="PIX">Pix</option>
                      ) : (
                        <option value="PAYPAL">PayPal</option>
                      )}
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
                  {isNational && (
                    <Field label="Link de pagamento (cartão)" hint="Opcional — pode ficar em branco">
                      <Input
                        placeholder="https://…"
                        value={form.creditCardPaymentLink}
                        onChange={(e) => update({ creditCardPaymentLink: e.target.value })}
                      />
                    </Field>
                  )}
                  {!isNational && (
                    <Field label={`Câmbio ${rateCurrency}/BRL`} hint={liveRate ? `Hoje: ${liveRate}` : undefined}>
                      <Input
                        type="number"
                        step="0.0001"
                        required
                        className="tabular"
                        value={form.exchangeRate}
                        onChange={(e) => update({ exchangeRate: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
              </FormSection>
          </Card>

          <Card className={`p-5 xl:col-start-2 xl:row-start-1 ${isEditing ? '' : 'max-xl:order-first'}`}>
              <FormSection title="Orçamento de origem">
                <Field
                  label="Orçamento"
                  hint={
                    isEditing
                      ? 'O orçamento de origem não muda depois que o pedido é criado.'
                      : currency
                        ? `Moeda do orçamento: ${currency}`
                        : undefined
                  }
                >
                  <Select
                    required
                    disabled={isEditing}
                    value={form.quoteId}
                    onChange={(e) => selectQuote(e.target.value)}
                  >
                    <option value="">Selecione um orçamento…</option>
                    {quotes?.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quoteNumber} — {q.clientName} — {q.currency} {formatAmount(q.total)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FormSection>
          </Card>

          <Card className="flex flex-col space-y-7 p-5 xl:col-start-2 xl:row-start-2">
              <FormSection title="Endereços">
                <AddressFields value={form} onChange={update} />
              </FormSection>

              <FormSection
                title="Nota fiscal"
                description={isEditing ? undefined : 'Opcional — pode preencher depois no detalhe do pedido.'}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <InvoiceFields value={form} onChange={update} />
                </div>
              </FormSection>

              {isEditing && <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">{documentsNote}</p>}

              <div className="mt-auto flex flex-col gap-2 border-t border-black/[0.06] pt-5">
                <Button type="submit" variant="primary" size="lg" disabled={saveOrder.isPending}>
                  {saveOrder.isPending
                    ? isEditing
                      ? 'Salvando…'
                      : 'Gerando documentos…'
                    : isEditing
                      ? 'Salvar e regenerar documentos'
                      : 'Criar pedido e gerar documentos'}
                </Button>
                <Button type="button" onClick={() => navigate(isEditing ? `/pedidos/${editId}` : '/pedidos')}>
                  Cancelar
                </Button>
              </div>
          </Card>
        </div>
      </form>
    </Page>
  )
}
