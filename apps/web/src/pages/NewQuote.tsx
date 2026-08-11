import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ClientPrefix, Currency, PriceTier, ProductDTO, QuoteDTO, QuoteLanguage } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import {
  BackLink,
  Button,
  Card,
  Field,
  FormSection,
  Input,
  Page,
  Select,
  Textarea,
} from '../components/ui'
import { ClientPicker } from '../components/ClientPicker'
import { IconPlus } from '../components/icons'

interface DraftItem {
  productId: string
  query: string
  quantity: number
  description: string
  unitPrice: string
}

async function searchProducts(search: string) {
  const { data } = await api.get<{ products: ProductDTO[] }>('/products', { params: { search } })
  return data.products
}

async function fetchQuote(id: string) {
  const { data } = await api.get<{ quote: QuoteDTO }>(`/quotes/${id}`)
  return data.quote
}

const prefixLabelsByLanguage: Record<QuoteLanguage, Record<ClientPrefix, string>> = {
  PT: { NONE: '—', MR: 'Sr.', MS: 'Sra.' },
  EN: { NONE: '—', MR: 'Mr.', MS: 'Ms.' },
  ES: { NONE: '—', MR: 'Sr.', MS: 'Sra.' },
}

const emptyItem: DraftItem = { productId: '', query: '', quantity: 1, description: '', unitPrice: '' }

export function NewQuote() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id: editId } = useParams<{ id: string }>()
  const isEditing = !!editId
  const [searchParams] = useSearchParams()
  const preselectId = searchParams.get('clientId')

  const [language, setLanguage] = useState<QuoteLanguage>('EN')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [priceTier, setPriceTier] = useState<PriceTier>('FINAL')
  const [clientPrefix, setClientPrefix] = useState<ClientPrefix>('NONE')
  const [clientName, setClientName] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [freight, setFreight] = useState('')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const prefilled = useRef(false)

  const { data: existingQuote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', editId],
    queryFn: () => fetchQuote(editId as string),
    enabled: isEditing,
  })

  // Preenche o form a partir do orçamento existente uma única vez, quando
  // editando — depois disso o estado é só do usuário, sem re-sincronizar.
  useEffect(() => {
    if (!existingQuote || prefilled.current) return
    prefilled.current = true
    setLanguage(existingQuote.language)
    setCurrency(existingQuote.currency)
    setPriceTier(existingQuote.priceTier)
    setClientPrefix(existingQuote.clientPrefix)
    setClientName(existingQuote.clientName)
    setClientId(existingQuote.clientId)
    setNotes(existingQuote.notes ?? '')
    setFreight(existingQuote.freight ?? '')
    setDiscount(existingQuote.discount)
    setItems(
      existingQuote.items.map((item) => {
        const listPrice = item.listPrice !== null ? Number(item.listPrice) : null
        const unitPrice = Number(item.unitPrice)
        // Só marca como "customizado" quando difere do preço de tabela (ou
        // não existe preço de tabela) — senão o campo fica vazio e o preço
        // continua acompanhando a tabela normalmente.
        const isCustomPrice = listPrice === null || unitPrice !== listPrice
        return {
          productId: item.productId,
          query: `${item.productName} (${item.sku})`,
          quantity: item.quantity,
          description: item.description,
          unitPrice: isCustomPrice ? String(unitPrice) : '',
        }
      }),
    )
  }, [existingQuote])

  const activeQuery = activeIndex !== null ? items[activeIndex].query.trim() : ''
  const { data: suggestions } = useQuery({
    queryKey: ['product-search', activeQuery],
    queryFn: () => searchProducts(activeQuery),
    enabled: activeIndex !== null && activeQuery.length > 0,
  })

  const createQuote = useMutation({
    mutationFn: async () => {
      const payload = {
        language,
        currency,
        priceTier: currency === 'USD' ? priceTier : 'FINAL',
        clientPrefix,
        clientName,
        clientId: clientId ?? undefined,
        notes: notes || undefined,
        items: items
          .filter((i) => i.productId.trim())
          .map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            description: i.description || undefined,
            unitPrice: i.unitPrice ? Number(i.unitPrice) : undefined,
          })),
        freight: freight === '' ? undefined : Number(freight),
        discount: Number(discount),
      }
      const { data } = isEditing
        ? await api.patch<{ quote: QuoteDTO }>(`/quotes/${editId}`, payload)
        : await api.post<{ quote: QuoteDTO }>('/quotes', payload)
      return data.quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['quote', editId] })
      navigate('/orcamentos')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (isEditing ? 'Não foi possível salvar o orçamento.' : 'Não foi possível gerar o orçamento.')
      setError(message)
    },
  })

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function selectProduct(index: number, product: ProductDTO) {
    updateItem(index, { productId: product.id, query: `${product.name} (${product.sku})` })
    setActiveIndex(null)
  }

  const currentPrefixLabels = prefixLabelsByLanguage[language]

  if (isEditing && loadingQuote) {
    return (
      <Page title="Editar orçamento" width="narrow">
        <div className="-mt-4 mb-5">
          <BackLink to="/orcamentos">Orçamentos</BackLink>
        </div>
        <p className="text-[13px] text-neutral-500">Carregando orçamento…</p>
      </Page>
    )
  }

  return (
    <Page
      title={isEditing ? `Editar orçamento ${existingQuote?.quoteNumber ?? ''}` : 'Novo orçamento'}
      description={
        isEditing
          ? 'Altera os dados do orçamento e regenera o PDF e o Excel automaticamente.'
          : 'Gere um orçamento automático em PDF ou Excel buscando produtos por nome ou SKU.'
      }
      width="narrow"
    >
      <div className="-mt-4 mb-5">
        <BackLink to="/orcamentos">Orçamentos</BackLink>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createQuote.mutate()
        }}
      >
        {error && (
          <div className="animate-fade-in mb-4 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
            {error}
          </div>
        )}

        <Card className="space-y-7 p-6">
          <FormSection title="Documento">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Idioma">
                <Select value={language} onChange={(e) => setLanguage(e.target.value as QuoteLanguage)}>
                  <option value="PT">Português</option>
                  <option value="EN">English</option>
                  <option value="ES">Español</option>
                </Select>
              </Field>
              <Field label="Moeda">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option value="BRL">Real (BRL)</option>
                  <option value="USD">Dólar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </Select>
              </Field>
              {currency === 'USD' && (
                <Field label="Tabela">
                  <Select value={priceTier} onChange={(e) => setPriceTier(e.target.value as PriceTier)}>
                    <option value="FINAL">Final</option>
                    <option value="DISTRIBUTOR">Distribuidor</option>
                  </Select>
                </Field>
              )}
            </div>
          </FormSection>

          <FormSection title="Cliente">
            <div className="flex flex-wrap gap-4">
              <Field label="Prefixo" className="w-28">
                <Select value={clientPrefix} onChange={(e) => setClientPrefix(e.target.value as ClientPrefix)}>
                  <option value="NONE">{currentPrefixLabels.NONE}</option>
                  <option value="MR">{currentPrefixLabels.MR}</option>
                  <option value="MS">{currentPrefixLabels.MS}</option>
                </Select>
              </Field>
              <Field
                label="Cliente"
                className="min-w-48 flex-1"
                hint="Escolha um cliente do cadastro, crie na hora ou digite só o nome."
              >
                <ClientPicker
                  clientId={clientId}
                  clientName={clientName}
                  preselectId={preselectId}
                  onChange={({ clientId: id, clientName: name, client }) => {
                    setClientId(id)
                    setClientName(name)
                    // Um cliente do cadastro traz o próprio tratamento; digitação
                    // livre não mexe no que o usuário já escolheu no seletor.
                    if (client) setClientPrefix(client.prefix)
                  }}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Itens">
            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div key={index} className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3">
                  <div className="flex gap-2">
                    <Field label="Produto" hint="Busca por nome, SKU ou palavra da descrição" className="relative flex-1">
                      <Input
                        placeholder="Buscar por nome ou SKU"
                        required
                        value={item.query}
                        onFocus={() => setActiveIndex(index)}
                        onChange={(e) => {
                          updateItem(index, { query: e.target.value, productId: '' })
                          setActiveIndex(index)
                        }}
                        onBlur={() => setTimeout(() => setActiveIndex((cur) => (cur === index ? null : cur)), 150)}
                      />
                      {activeIndex === index && suggestions && suggestions.length > 0 && (
                        <div className="animate-scale-in absolute z-20 mt-1.5 max-h-64 w-full origin-top overflow-y-auto rounded-xl border border-neutral-200/70 bg-white p-1 shadow-lg">
                          {suggestions.map((product) => (
                            <button
                              type="button"
                              key={product.id}
                              onMouseDown={() => selectProduct(index, product)}
                              className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-neutral-500/8"
                            >
                              <span className="font-medium text-ink-900">{product.name}</span>{' '}
                              <span className="tabular text-neutral-400">{product.sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                    <Field label="Qtd." className="w-20 shrink-0">
                      <Input
                        type="number"
                        min={1}
                        required
                        aria-label="Quantidade"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                        className="tabular text-center"
                      />
                    </Field>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Remover item"
                        className="mt-[26px] flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-brand-50 hover:text-brand-600 active:scale-90"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Field
                      label="Descrição customizada"
                      hint="Opcional — substitui a descrição do catálogo só neste orçamento"
                      className="flex-1"
                    >
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        className="h-9 text-[13px]"
                      />
                    </Field>
                    <Field
                      label="Preço customizado"
                      hint="Opcional — sobrescreve o preço de tabela só neste item"
                      className="w-44 shrink-0"
                    >
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                        className="tabular h-9 text-[13px]"
                      />
                    </Field>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                size="sm"
                onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}
                className="w-full border-dashed"
              >
                <IconPlus className="h-3.5 w-3.5" />
                Adicionar item
              </Button>
            </div>
          </FormSection>

          <FormSection title="Valores e observações">
            <div className="flex flex-wrap gap-4">
              <Field label="Frete" hint="Em branco = a definir" className="w-36">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="A definir"
                  value={freight}
                  onChange={(e) => setFreight(e.target.value)}
                  className="tabular"
                />
              </Field>
              <Field label="Desconto" className="w-36">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="tabular"
                />
              </Field>
            </div>

            <Field label="Comentários" hint="Se deixar em branco, usamos o texto padrão." className="mt-4">
              <Textarea
                rows={3}
                placeholder="ex: Prazo estimado, forma de pagamento, validade do orçamento…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </FormSection>
        </Card>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={() => navigate('/orcamentos')}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={createQuote.isPending}>
            {createQuote.isPending
              ? isEditing
                ? 'Salvando…'
                : 'Gerando…'
              : isEditing
                ? 'Salvar orçamento'
                : 'Gerar orçamento'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
