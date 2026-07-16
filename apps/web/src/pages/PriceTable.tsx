import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ProductDTO, ProductKind } from '@prodelphusplus/shared'
import { api } from '../lib/api'

async function fetchProducts(search: string) {
  const { data } = await api.get<{ products: ProductDTO[] }>('/products', {
    params: { search: search || undefined },
  })
  return data.products
}

function formatPrice(value: string | null, currency: string) {
  return value === null ? '—' : `${currency} ${Number(value).toFixed(2)}`
}

const kindLabel: Record<ProductKind, string> = {
  COMPLETE_MODEL: 'Modelo completo',
  COMPONENT: 'Componentes / Peças',
}

interface PriceColumns {
  description: boolean
  brl: boolean
  usd: boolean
  usdDistributor: boolean
}

const COLUMNS_STORAGE_KEY = 'price-table-columns'

const defaultColumns: PriceColumns = {
  description: true,
  brl: true,
  usd: true,
  usdDistributor: false,
}

function loadStoredColumns(): PriceColumns {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return defaultColumns
    return { ...defaultColumns, ...JSON.parse(raw) }
  } catch {
    return defaultColumns
  }
}

export function PriceTable() {
  const [search, setSearch] = useState('')
  const [columns, setColumns] = useState<PriceColumns>(loadStoredColumns)

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['products-price-table', search],
    queryFn: () => fetchProducts(search),
  })

  const grouped = useMemo(() => {
    const bySector = new Map<string, { COMPLETE_MODEL: ProductDTO[]; COMPONENT: ProductDTO[] }>()
    for (const product of products ?? []) {
      const group = bySector.get(product.sector) ?? { COMPLETE_MODEL: [], COMPONENT: [] }
      group[product.kind].push(product)
      bySector.set(product.sector, group)
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

  const columnCount = 2 + Number(columns.brl) + Number(columns.usd) + Number(columns.usdDistributor)

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Tabela de Preços</h1>
      <p className="mt-1 text-neutral-500">
        Consulta de preços por setor. Para alterar um preço, edite o produto correspondente.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input
          placeholder="Buscar por SKU, nome, setor ou descrição"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
          <span className="text-xs font-medium uppercase text-neutral-400">Colunas</span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={columns.description} onChange={() => toggleColumn('description')} />
            Descrição
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={columns.brl} onChange={() => toggleColumn('brl')} />
            Final BRL
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={columns.usd} onChange={() => toggleColumn('usd')} />
            Final USD
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={columns.usdDistributor} onChange={() => toggleColumn('usdDistributor')} />
            Distribuidor USD
          </label>
        </div>
      </div>

      {isLoading && <p className="mt-6 text-neutral-400">Carregando…</p>}
      {isError && (
        <p className="mt-6 text-brand-600">
          Não foi possível carregar a tabela de preços. Verifique sua conexão e tente novamente.
        </p>
      )}

      <div className="mt-6 space-y-8">
        {grouped.map(([sector, groups]) => (
          <div key={sector}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-900">{sector}</h2>
            {(['COMPLETE_MODEL', 'COMPONENT'] as ProductKind[]).map((kind) => {
              const items = groups[kind]
              if (items.length === 0) return null
              return (
                <div key={kind} className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      {kindLabel[kind]}
                    </h3>
                  </div>
                  <table className="min-w-full divide-y divide-neutral-100 text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-neutral-500">SKU</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-500">Nome</th>
                        {columns.description && (
                          <th className="px-4 py-2 text-left font-medium text-neutral-500">Descrição</th>
                        )}
                        {columns.brl && <th className="px-4 py-2 text-left font-medium text-neutral-500">Final BRL</th>}
                        {columns.usd && <th className="px-4 py-2 text-left font-medium text-neutral-500">Final USD</th>}
                        {columns.usdDistributor && (
                          <th className="px-4 py-2 text-left font-medium text-neutral-500">Distribuidor USD</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {items.map((product) => (
                        <tr key={product.id}>
                          <td className="px-4 py-2 font-medium text-ink-900">{product.sku}</td>
                          <td className="px-4 py-2 text-neutral-600">{product.name}</td>
                          {columns.description && (
                            <td className="max-w-md px-4 py-2 text-xs text-neutral-500">
                              {product.description ?? '—'}
                            </td>
                          )}
                          {columns.brl && (
                            <td className="px-4 py-2 text-ink-900">{formatPrice(product.priceBRL, 'BRL')}</td>
                          )}
                          {columns.usd && (
                            <td className="px-4 py-2 text-ink-900">{formatPrice(product.priceUSD, 'USD')}</td>
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
              )
            })}
          </div>
        ))}
        {!isLoading && !isError && grouped.length === 0 && (
          <p className="text-neutral-400">Nenhum item encontrado.</p>
        )}
      </div>
      {columnCount === 2 && (
        <p className="mt-4 text-xs text-neutral-400">Selecione ao menos uma coluna de preço para visualizar.</p>
      )}
    </div>
  )
}
