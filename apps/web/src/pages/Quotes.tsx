import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClientPrefix, PriceTier, ProductDTO, QuoteDTO, QuoteLanguage } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

interface DraftItem {
  productId: string
  query: string
  quantity: number
  description: string
}

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
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

const languageLabel: Record<QuoteLanguage, string> = {
  PT: 'Português',
  EN: 'English',
  ES: 'Español',
}

const emptyItem: DraftItem = { productId: '', query: '', quantity: 1, description: '' }

const monthLabels = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function Quotes() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: quotes, isLoading } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })

  const [language, setLanguage] = useState<QuoteLanguage>('PT')
  const [priceTier, setPriceTier] = useState<PriceTier>('FINAL')
  const [clientPrefix, setClientPrefix] = useState<ClientPrefix>('NONE')
  const [clientName, setClientName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [freight, setFreight] = useState('')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)

  const availableYears = useMemo(() => {
    const years = new Set((quotes ?? []).map((q) => new Date(q.createdAt).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [quotes])

  const filteredQuotes = useMemo(() => {
    return (quotes ?? []).filter((q) => {
      const date = new Date(q.createdAt)
      if (yearFilter !== 'all' && date.getFullYear() !== Number(yearFilter)) return false
      if (monthFilter !== 'all' && date.getMonth() !== Number(monthFilter)) return false
      if (onlyMine && q.createdBy.id !== user?.id) return false
      return true
    })
  }, [quotes, yearFilter, monthFilter, onlyMine, user?.id])

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
        priceTier: language === 'PT' ? 'FINAL' : priceTier,
        clientPrefix,
        clientName,
        notes: notes || undefined,
        items: items
          .filter((i) => i.productId.trim())
          .map((i) => ({ productId: i.productId, quantity: i.quantity, description: i.description || undefined })),
        freight: freight === '' ? undefined : Number(freight),
        discount: Number(discount),
      })
      return data.quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setClientPrefix('NONE')
      setClientName('')
      setNotes('')
      setItems([{ ...emptyItem }])
      setFreight('')
      setDiscount('0')
      setError(null)
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
      <h1 className="text-2xl font-bold text-ink-900">Orçamentos</h1>
      <p className="mt-1 text-neutral-500">Gere orçamentos automáticos em PDF ou Excel buscando por nome ou SKU.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createQuote.mutate()
        }}
        className="mt-4 max-w-2xl rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Novo orçamento</h2>

        {error && <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>}

        <div className="mb-3 flex gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Idioma</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as QuoteLanguage)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="PT">Português</option>
              <option value="EN">English</option>
              <option value="ES">Español</option>
            </select>
            <p className="mt-1 text-[11px] text-neutral-400">
              Moeda: {language === 'PT' ? 'BRL' : 'USD'}
            </p>
          </div>
          {language !== 'PT' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Preço</label>
              <select
                value={priceTier}
                onChange={(e) => setPriceTier(e.target.value as PriceTier)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="NONE">{currentPrefixLabels.NONE}</option>
              <option value="MR">{currentPrefixLabels.MR}</option>
              <option value="MS">{currentPrefixLabels.MS}</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Nome do cliente</label>
            <input
              required
              placeholder="ex: Margarida Cunha"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-neutral-100 p-2">
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  {activeIndex === index && suggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
                      {suggestions.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          onMouseDown={() => selectProduct(index, product)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
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
                  className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    remover
                  </button>
                )}
              </div>
              <input
                placeholder="Descrição customizada para este item (opcional — senão usa a do produto)"
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}
            className="text-xs font-medium text-brand-600 hover:underline"
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
              className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 mt-3 block text-xs font-medium text-neutral-600">
          Observações (opcional — se deixar em branco, usamos um texto padrão)
        </label>
        <textarea
          rows={3}
          placeholder={'ex: Prazo estimado, forma de pagamento, validade do orçamento...'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={createQuote.isPending}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {createQuote.isPending ? 'Gerando…' : 'Gerar orçamento'}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">Histórico</h2>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Todos os anos</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Todos os meses</option>
          {monthLabels.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Meus orçamentos
        </label>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Número</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Cliente</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Idioma</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Data</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Criado por</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Itens</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Total</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-500">Arquivos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-neutral-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && filteredQuotes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-neutral-400">
                  Nenhum orçamento encontrado para o filtro selecionado.
                </td>
              </tr>
            )}
            {filteredQuotes.map((q) => (
              <tr key={q.id}>
                <td className="px-4 py-2 font-medium text-ink-900">{q.quoteNumber}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {q.clientPrefix !== 'NONE' && `${prefixLabelsByLanguage[q.language][q.clientPrefix]} `}
                  {q.clientName}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {languageLabel[q.language]}
                  {q.priceTier === 'DISTRIBUTOR' && (
                    <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                      Distribuidor
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-500">{new Date(q.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2 text-neutral-500">{q.createdBy.name}</td>
                <td className="px-4 py-2 text-neutral-600">{q.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}</td>
                <td className="px-4 py-2 text-ink-900">{Number(q.total).toFixed(2)}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  {q.pdfUrl && (
                    <a
                      href={q.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      PDF
                    </a>
                  )}
                  {q.xlsxUrl && (
                    <a
                      href={q.xlsxUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Excel
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
