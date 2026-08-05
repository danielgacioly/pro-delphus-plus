import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatAmount, type ProductDTO, type ProductKind, type SectorDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { localize, localizeSector } from '../lib/catalogTranslation'
import { EmptyState } from '../components/EmptyState'
import { IconAlert, IconSearch, IconSliders } from '../components/icons'
import { useClickOutside } from '../lib/useClickOutside'

async function fetchProducts(search: string) {
  const { data } = await api.get<{ products: ProductDTO[] }>('/products', {
    params: { search: search || undefined },
  })
  return data.products
}

async function fetchSectorList() {
  const { data } = await api.get<{ sectors: SectorDTO[] }>('/sectors')
  return data.sectors
}

function formatPrice(value: string | null, currency: string) {
  return value === null ? '—' : `${currency} ${formatAmount(value)}`
}

const kindLabel: Record<ProductKind, string> = {
  COMPLETE_MODEL: 'Modelo completo',
  COMPONENT: 'Componentes / Peças',
}

interface PriceColumns {
  description: boolean
  components: boolean
  brl: boolean
  usd: boolean
  eur: boolean
  usdDistributor: boolean
}

const COLUMNS_STORAGE_KEY = 'price-table-columns'

const defaultColumns: PriceColumns = {
  description: true,
  components: true,
  brl: true,
  usd: true,
  eur: true,
  usdDistributor: false,
}

const columnOptions: { key: keyof PriceColumns; label: string }[] = [
  { key: 'description', label: 'Descrição' },
  { key: 'components', label: 'Componentes' },
  { key: 'brl', label: 'Final BRL' },
  { key: 'usd', label: 'Final USD' },
  { key: 'eur', label: 'Final EUR' },
  { key: 'usdDistributor', label: 'Distribuidor USD' },
]

function loadStoredColumns(): PriceColumns {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return defaultColumns
    return { ...defaultColumns, ...JSON.parse(raw) }
  } catch {
    return defaultColumns
  }
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <div className="skeleton h-3 w-32 rounded" />
      </div>
      <div className="divide-y divide-neutral-100 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2.5">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-3 w-40 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PriceTable() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const lang = user?.catalogLanguage ?? 'EN'
  const [search, setSearch] = useState('')
  const [columns, setColumns] = useState<PriceColumns>(loadStoredColumns)
  const [exporting, setExporting] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsRef = useRef<HTMLDivElement>(null)
  useClickOutside(columnsRef, () => setColumnsOpen(false))

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['products-price-table', search],
    queryFn: () => fetchProducts(search),
  })

  const { data: sectorList } = useQuery({ queryKey: ['sector-list'], queryFn: fetchSectorList })

  const grouped = useMemo(() => {
    // A product with more than one sector shows up once per sector it belongs to.
    const bySector = new Map<string, { COMPLETE_MODEL: ProductDTO[]; COMPONENT: ProductDTO[] }>()
    for (const product of products ?? []) {
      for (const sector of product.sectors) {
        const group = bySector.get(sector) ?? { COMPLETE_MODEL: [], COMPONENT: [] }
        group[product.kind].push(product)
        bySector.set(sector, group)
      }
    }
    return Array.from(bySector.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [products])

  function toggleColumn(key: keyof PriceColumns) {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // storage indisponível (modo privado etc.) — seleção vale só para a sessão
      }
      return next
    })
  }

  const columnCount =
    2 + Number(columns.brl) + Number(columns.usd) + Number(columns.eur) + Number(columns.usdDistributor)
  const activeColumnCount = columnOptions.filter((c) => columns[c.key]).length

  async function exportPdf() {
    setExporting(true)
    try {
      const { data } = await api.get('/products/price-list-pdf', {
        params: {
          search: search || undefined,
          description: columns.description ? '1' : '0',
          components: columns.components ? '1' : '0',
          brl: columns.brl ? '1' : '0',
          usd: columns.usd ? '1' : '0',
          eur: columns.eur ? '1' : '0',
          usdDistributor: columns.usdDistributor ? '1' : '0',
        },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'tabela-de-precos.pdf'
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Tabela de Preços</h1>
      <p className="mt-1 text-neutral-500">
        Consulta de preços por setor. Para alterar um preço, edite o produto correspondente.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Buscar por SKU, nome, setor ou descrição"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div ref={columnsRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnsOpen((s) => !s)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              columnsOpen
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
            }`}
          >
            <IconSliders className="h-4 w-4" />
            Colunas
            <span className="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-500">{activeColumnCount}</span>
          </button>
          {columnsOpen && (
            <div className="animate-scale-in absolute left-0 top-full z-20 mt-2 w-56 origin-top-left rounded-xl border border-neutral-200 bg-white p-2 shadow-lg shadow-ink-900/5">
              {columnOptions.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {c.label}
                  <input
                    type="checkbox"
                    checked={columns[c.key]}
                    onChange={() => toggleColumn(c.key)}
                    className="h-3.5 w-3.5 accent-brand-600"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting}
          className="ml-auto rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
        >
          {exporting ? 'Gerando PDF…' : 'Exportar PDF'}
        </button>
      </div>

      {isLoading && <div className="mt-6"><SkeletonTable /></div>}
      {isError && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <IconAlert className="h-4 w-4 shrink-0" />
          Não foi possível carregar a tabela de preços. Verifique sua conexão e tente novamente.
        </div>
      )}

      <div className="mt-6 space-y-8">
        {grouped.map(([sector, groups], groupIndex) => (
          <div
            key={sector}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(groupIndex, 8) * 40}ms` }}
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-900">
              {localizeSector(sector, sectorList, lang)}
            </h2>
            {(['COMPLETE_MODEL', 'COMPONENT'] as ProductKind[]).map((kind) => {
              const items = groups[kind]
              if (items.length === 0) return null
              return (
                <div
                  key={kind}
                  className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-sm"
                >
                  <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      {kindLabel[kind]}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-100 text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-neutral-500">SKU</th>
                          <th className="px-4 py-2 text-left font-medium text-neutral-500">Nome</th>
                          {columns.description && (
                            <th className="px-4 py-2 text-left font-medium text-neutral-500">Descrição</th>
                          )}
                          {columns.components && kind === 'COMPLETE_MODEL' && (
                            <th className="px-4 py-2 text-left font-medium text-neutral-500">Componentes</th>
                          )}
                          {columns.brl && (
                            <th className="px-4 py-2 text-left font-medium text-neutral-500">Final BRL</th>
                          )}
                          {columns.usd && (
                            <th className="px-4 py-2 text-left font-medium text-neutral-500">Final USD</th>
                          )}
                          {columns.eur && (
                            <th className="px-4 py-2 text-left font-medium text-neutral-500">Final EUR</th>
                          )}
                          {columns.usdDistributor && (
                            <th className="px-4 py-2 text-left font-medium text-neutral-500">Distribuidor USD</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {items.map((product) => (
                          <tr
                            key={product.id}
                            onClick={() => navigate(`/produtos?highlight=${product.id}`)}
                            className="cursor-pointer transition-colors hover:bg-neutral-50"
                          >
                            <td className="px-4 py-2 font-medium text-ink-900">{product.sku}</td>
                            <td className="px-4 py-2 text-brand-700 hover:underline">{product.name}</td>
                            {columns.description && (
                              <td className="max-w-md px-4 py-2 text-xs text-neutral-500">
                                {localize(product.description, product.descriptionPt, lang) ?? '—'}
                              </td>
                            )}
                            {columns.components && kind === 'COMPLETE_MODEL' && (
                              <td className="max-w-md px-4 py-2 text-xs text-neutral-500">
                                {localize(product.components, product.componentsPt, lang) ?? '—'}
                              </td>
                            )}
                            {columns.brl && (
                              <td className="px-4 py-2 text-ink-900">{formatPrice(product.priceBRL, 'BRL')}</td>
                            )}
                            {columns.usd && (
                              <td className="px-4 py-2 text-ink-900">{formatPrice(product.priceUSD, 'USD')}</td>
                            )}
                            {columns.eur && (
                              <td className="px-4 py-2 text-ink-900">{formatPrice(product.priceEUR, 'EUR')}</td>
                            )}
                            {columns.usdDistributor && (
                              <td className="px-4 py-2 text-ink-900">
                                {formatPrice(product.priceUSDDistributor, 'USD')}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {!isLoading && !isError && grouped.length === 0 && (
          <EmptyState
            title="Nenhum item encontrado"
            description={search ? 'Tente ajustar sua busca.' : 'Ainda não há produtos cadastrados.'}
          />
        )}
      </div>
      {columnCount === 2 && (
        <p className="mt-4 text-xs text-neutral-400">Selecione ao menos uma coluna de preço para visualizar.</p>
      )}
    </div>
  )
}
