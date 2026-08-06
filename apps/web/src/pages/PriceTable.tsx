import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatAmount, type ProductDTO, type ProductKind, type SectorDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { localize, localizeSector } from '../lib/catalogTranslation'
import { useClickOutside } from '../lib/useClickOutside'
import { cn } from '../lib/cn'
import { Button, EmptyState, Page, SearchField, Skeleton, Toolbar } from '../components/ui'
import { IconAlert, IconSliders } from '../components/icons'

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
  COMPLETE_MODEL: 'Modelos completos',
  COMPONENT: 'Componentes e peças',
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

function SkeletonGroup() {
  return (
    <div className="space-y-8">
      {[0, 1].map((g) => (
        <div key={g}>
          <Skeleton className="h-3.5 w-48" />
          <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <div className="border-b border-neutral-200/70 bg-neutral-50/80 px-4 py-2.5">
              <Skeleton className="h-2.5 w-32" />
            </div>
            <div className="divide-y divide-neutral-200/60">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-6 px-4 py-3">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-52" />
                  <Skeleton className="ml-auto h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const priceHeadClass =
  'whitespace-nowrap border-b border-neutral-200/70 px-4 py-2.5 text-right text-[12px] font-semibold text-neutral-500'
const priceCellClass = 'tabular whitespace-nowrap px-4 py-2.5 text-right text-ink-900'

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
    // Um produto com mais de um setor aparece uma vez em cada setor.
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

  const priceColumnCount =
    Number(columns.brl) + Number(columns.usd) + Number(columns.eur) + Number(columns.usdDistributor)
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
    <Page
      title="Tabela de Preços"
      description="Consulta de preços por setor. Para alterar um preço, edite o produto correspondente."
      actions={
        <Button variant="primary" size="sm" onClick={exportPdf} disabled={exporting}>
          {exporting ? 'Gerando PDF…' : 'Exportar PDF'}
        </Button>
      }
    >
      <Toolbar className="mb-6">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por SKU, nome ou setor"
          className="w-full sm:w-80"
        />

        <div ref={columnsRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnsOpen((s) => !s)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-xs',
              'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]',
              columnsOpen
                ? 'border-neutral-300 bg-neutral-50 text-ink-900'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-ink-900',
            )}
          >
            <IconSliders className="h-4 w-4" />
            Colunas
            <span className="rounded-full bg-neutral-500/12 px-1.5 text-[11px] text-neutral-600">
              {activeColumnCount}
            </span>
          </button>

          {columnsOpen && (
            <div className="animate-scale-in absolute left-0 top-full z-20 mt-2 w-60 origin-top-left rounded-xl border border-neutral-200/70 bg-white p-1.5 shadow-lg">
              {columnOptions.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-[13px] text-neutral-700 transition-colors hover:bg-neutral-500/8"
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
      </Toolbar>

      {priceColumnCount === 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-amber-500/12 px-4 py-3 text-[13px] text-amber-800">
          <IconAlert className="h-4 w-4 shrink-0" />
          Selecione ao menos uma coluna de preço para visualizar os valores.
        </div>
      )}

      {isLoading && <SkeletonGroup />}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          <IconAlert className="h-4 w-4 shrink-0" />
          Não foi possível carregar a tabela de preços. Verifique sua conexão e tente novamente.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-9">
          {grouped.map(([sector, groups], groupIndex) => {
            const total = groups.COMPLETE_MODEL.length + groups.COMPONENT.length
            return (
              <section
                key={sector}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(groupIndex, 8) * 40}ms` }}
              >
                <div className="mb-3 flex items-baseline gap-2.5">
                  <h2 className="text-title text-ink-900">{localizeSector(sector, sectorList, lang)}</h2>
                  <span className="tabular text-[13px] text-neutral-400">
                    {total} {total === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
                  {(['COMPLETE_MODEL', 'COMPONENT'] as ProductKind[]).map((kind) => {
                    const items = groups[kind]
                    if (items.length === 0) return null
                    const showComponents = columns.components && kind === 'COMPLETE_MODEL'
                    return (
                      <div key={kind} className="border-t border-neutral-200/70 first:border-t-0">
                        <div className="bg-neutral-50/80 px-4 py-2">
                          <h3 className="text-eyebrow text-neutral-500">{kindLabel[kind]}</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr>
                                <th className="whitespace-nowrap border-b border-neutral-200/70 px-4 py-2.5 text-left text-[12px] font-semibold text-neutral-500">
                                  SKU
                                </th>
                                <th className="border-b border-neutral-200/70 px-4 py-2.5 text-left text-[12px] font-semibold text-neutral-500">
                                  Nome
                                </th>
                                {columns.description && (
                                  <th className="border-b border-neutral-200/70 px-4 py-2.5 text-left text-[12px] font-semibold text-neutral-500">
                                    Descrição
                                  </th>
                                )}
                                {showComponents && (
                                  <th className="border-b border-neutral-200/70 px-4 py-2.5 text-left text-[12px] font-semibold text-neutral-500">
                                    Componentes
                                  </th>
                                )}
                                {columns.brl && <th className={priceHeadClass}>Final BRL</th>}
                                {columns.usd && <th className={priceHeadClass}>Final USD</th>}
                                {columns.eur && <th className={priceHeadClass}>Final EUR</th>}
                                {columns.usdDistributor && <th className={priceHeadClass}>Distrib. USD</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200/60">
                              {items.map((product) => (
                                <tr
                                  key={product.id}
                                  onClick={() => navigate(`/produtos?highlight=${product.id}`)}
                                  title="Abrir no catálogo de produtos"
                                  className="group cursor-pointer transition-colors duration-150 hover:bg-neutral-500/6"
                                >
                                  <td className="tabular whitespace-nowrap px-4 py-2.5 font-medium text-neutral-500">
                                    {product.sku}
                                  </td>
                                  <td className="px-4 py-2.5 font-medium text-ink-900 group-hover:text-brand-700">
                                    {product.name}
                                  </td>
                                  {columns.description && (
                                    <td className="max-w-md px-4 py-2.5 text-[12.5px] leading-relaxed text-neutral-500">
                                      {localize(product.description, product.descriptionPt, lang) ?? '—'}
                                    </td>
                                  )}
                                  {showComponents && (
                                    <td className="max-w-md px-4 py-2.5 text-[12.5px] leading-relaxed text-neutral-500">
                                      {localize(product.components, product.componentsPt, lang) ?? '—'}
                                    </td>
                                  )}
                                  {columns.brl && (
                                    <td className={priceCellClass}>{formatPrice(product.priceBRL, 'BRL')}</td>
                                  )}
                                  {columns.usd && (
                                    <td className={priceCellClass}>{formatPrice(product.priceUSD, 'USD')}</td>
                                  )}
                                  {columns.eur && (
                                    <td className={priceCellClass}>{formatPrice(product.priceEUR, 'EUR')}</td>
                                  )}
                                  {columns.usdDistributor && (
                                    <td className={priceCellClass}>
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
              </section>
            )
          })}

          {grouped.length === 0 && (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
              <EmptyState
                title="Nenhum item encontrado"
                description={search ? 'Tente ajustar sua busca.' : 'Ainda não há produtos cadastrados.'}
              />
            </div>
          )}
        </div>
      )}
    </Page>
  )
}
