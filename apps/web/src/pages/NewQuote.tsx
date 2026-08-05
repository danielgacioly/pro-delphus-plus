import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import type { ClientPrefix, Currency, PriceTier, ProductDTO, QuoteDTO, QuoteLanguage } from '@prodelphusplus/shared'
import { api } from '../lib/api'

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

const prefixLabelsByLanguage: Record<QuoteLanguage, Record<ClientPrefix, string>> = {
  PT: { NONE: '—', MR: 'Sr.', MS: 'Sra.' },
  EN: { NONE: '—', MR: 'Mr.', MS: 'Ms.' },
  ES: { NONE: '—', MR: 'Sr.', MS: 'Sra.' },
}

const emptyItem: DraftItem = { productId: '', query: '', quantity: 1, description: '', unitPrice: '' }

const inputClass =
  'rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'
const smallInputClass =
  'rounded-lg border border-neutral-200 px-3 py-1.5 text-xs transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

export function NewQuote() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [language, setLanguage] = useState<QuoteLanguage>('EN')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [priceTier, setPriceTier] = useState<PriceTier>('FINAL')
  const [clientPrefix, setClientPrefix] = useState<ClientPrefix>('NONE')
  const [clientName, setClientName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [freight, setFreight] = useState('')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const activeQuery = activeIndex !== null ? items[activeIndex].query.trim() : ''
  const { data: suggestions } = useQuery({
    queryKey: ['product-search', activeQuery],
    queryFn: () => searchProducts(activeQuery),
    enabled: activeIndex !== null && activeQuery.length > 0,
  })

  const createQuote = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ quote: QuoteDTO }>('/quotes', {
        language,
        currency,
        priceTier: currency === 'USD' ? priceTier : 'FINAL',
        clientPrefix,
        clientName,
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
      })
      return data.quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate('/orcamentos')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível gerar o orçamento.'
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

  return (
    <div>
      <Link
        to="/orcamentos"
        className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <span className="transition-transform group-hover:-translate-x-0.5">←</span> Voltar para orçamentos
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink-900">Novo orçamento</h1>
      <p className="mt-1 text-neutral-500">Gere um orçamento automático em PDF ou Excel buscando por nome ou SKU.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createQuote.mutate()
        }}
        className="animate-fade-in-up mt-4 max-w-2xl rounded-xl border border-neutral-200 bg-white p-5"
      >
        {error && <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>}

        <div className="mb-3 flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Idioma</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as QuoteLanguage)}
              className={inputClass}
            >
              <option value="PT">Português</option>
              <option value="EN">English</option>
              <option value="ES">Español</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Moeda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={inputClass}>
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dólar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>
          {currency === 'USD' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Preço</label>
              <select
                value={priceTier}
                onChange={(e) => setPriceTier(e.target.value as PriceTier)}
                className={inputClass}
              >
                <option value="FINAL">Final</option>
                <option value="DISTRIBUTOR">Distribuidor</option>
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Prefixo</label>
            <select
              value={clientPrefix}
              onChange={(e) => setClientPrefix(e.target.value as ClientPrefix)}
              className={inputClass}
            >
              <option value="NONE">{currentPrefixLabels.NONE}</option>
              <option value="MR">{currentPrefixLabels.MR}</option>
              <option value="MS">{currentPrefixLabels.MS}</option>
            </select>
          </div>
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Nome do cliente</label>
            <input
              required
              placeholder="ex: Margarida Cunha"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={`w-full ${inputClass}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-2.5 transition-colors hover:bg-neutral-50"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    placeholder="Buscar por nome ou SKU"
                    required
                    value={item.query}
                    onFocus={() => setActiveIndex(index)}
                    onChange={(e) => {
                      updateItem(index, { query: e.target.value, productId: '' })
                      setActiveIndex(index)
                    }}
                    onBlur={() => setTimeout(() => setActiveIndex((cur) => (cur === index ? null : cur)), 150)}
                    className={`w-full bg-white ${inputClass}`}
                  />
                  {activeIndex === index && suggestions && suggestions.length > 0 && (
                    <div className="animate-scale-in absolute z-10 mt-1 w-full origin-top rounded-lg border border-neutral-200 bg-white shadow-lg shadow-ink-900/5">
                      {suggestions.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          onMouseDown={() => selectProduct(index, product)}
                          className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50"
                        >
                          <span className="font-medium text-ink-900">{product.name}</span>{' '}
                          <span className="text-neutral-400">— {product.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  required
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  className={`w-24 bg-white ${inputClass}`}
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    className="shrink-0 self-center text-xs font-medium text-neutral-400 transition-colors hover:text-brand-600"
                  >
                    remover
                  </button>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  placeholder="Descrição customizada para este item (opcional — senão usa a do produto)"
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  className={`flex-1 bg-white ${smallInputClass}`}
                />
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="Preço customizado (opcional)"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                  className={`w-44 bg-white ${smallInputClass}`}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            + adicionar item
          </button>
        </div>

        <div className="mt-3 flex gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Frete</label>
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder="A definir"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
              className={`w-32 ${inputClass}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Desconto</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className={`w-32 ${inputClass}`}
            />
          </div>
        </div>

        <label className="mb-1 mt-3 block text-xs font-medium text-neutral-600">
          Comentários (se deixar em branco, usamos o texto padrão)
        </label>
        <textarea
          rows={3}
          placeholder={'ex: Prazo estimado, forma de pagamento, validade do orçamento...'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`w-full ${inputClass}`}
        />

        <button
          type="submit"
          disabled={createQuote.isPending}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
        >
          {createQuote.isPending ? 'Gerando…' : 'Gerar orçamento'}
        </button>
      </form>
    </div>
  )
}
