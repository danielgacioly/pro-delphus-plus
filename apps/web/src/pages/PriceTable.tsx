import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PriceTableEntryDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

async function fetchEntries(search: string) {
  const { data } = await api.get<{ entries: PriceTableEntryDTO[] }>('/price-table', {
    params: { search: search || undefined },
  })
  return data.entries
}

function formatPrice(value: string | null, currency: string) {
  return value === null ? '—' : `${currency} ${Number(value).toFixed(2)}`
}

type MarketFilter = 'ALL' | 'NATIONAL' | 'INTERNATIONAL'

export function PriceTable() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL')

  const [newEntry, setNewEntry] = useState({
    sku: '',
    sector: '',
    description: '',
    priceBRL: '',
    priceUSD: '',
  })

  const { data: entries, isLoading } = useQuery({
    queryKey: ['price-table', search],
    queryFn: () => fetchEntries(search),
  })

  const showBRL = marketFilter !== 'INTERNATIONAL'
  const showUSD = marketFilter !== 'NATIONAL'

  const grouped = useMemo(() => {
    const filtered = (entries ?? []).filter((entry) => {
      if (marketFilter === 'NATIONAL') return entry.priceBRL !== null
      if (marketFilter === 'INTERNATIONAL') return entry.priceUSD !== null
      return true
    })

    const bySector = new Map<string, PriceTableEntryDTO[]>()
    for (const entry of filtered) {
      const list = bySector.get(entry.sector) ?? []
      list.push(entry)
      bySector.set(entry.sector, list)
    }
    return Array.from(bySector.entries())
  }, [entries, marketFilter])

  const createEntry = useMutation({
    mutationFn: async () => {
      await api.post('/price-table', {
        sku: newEntry.sku,
        sector: newEntry.sector,
        description: newEntry.description,
        priceBRL: newEntry.priceBRL ? Number(newEntry.priceBRL) : undefined,
        priceUSD: newEntry.priceUSD ? Number(newEntry.priceUSD) : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-table'] })
      setNewEntry({ sku: '', sector: '', description: '', priceBRL: '', priceUSD: '' })
    },
  })

  const updatePrice = useMutation({
    mutationFn: async ({ id, priceBRL, priceUSD }: { id: string; priceBRL: number | null; priceUSD: number | null }) => {
      await api.patch(`/price-table/${id}`, { priceBRL, priceUSD })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-table'] }),
  })

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/price-table/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-table'] }),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Tabela de Preços</h1>
      <p className="mt-1 text-neutral-500">
        Consulte os preços em reais e em dólar dos produtos Pro Delphus, organizados por setor.
      </p>

      <div className="mt-4 flex gap-3">
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value as MarketFilter)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Nacional e internacional</option>
          <option value="NATIONAL">Nacional (BRL)</option>
          <option value="INTERNATIONAL">Internacional (USD)</option>
        </select>
        <input
          placeholder="Buscar por SKU, descrição ou setor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createEntry.mutate()
          }}
          className="mt-4 grid max-w-3xl grid-cols-4 gap-3 rounded-xl border border-neutral-200 bg-white p-4"
        >
          <h2 className="col-span-4 text-sm font-semibold text-neutral-700">Novo item</h2>
          <input
            placeholder="SKU"
            required
            value={newEntry.sku}
            onChange={(e) => setNewEntry((s) => ({ ...s, sku: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Setor (ex: Laparoscopy)"
            required
            list="sectors"
            value={newEntry.sector}
            onChange={(e) => setNewEntry((s) => ({ ...s, sector: e.target.value }))}
            className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <datalist id="sectors">
            {grouped.map(([sector]) => (
              <option key={sector} value={sector} />
            ))}
          </datalist>
          <input
            placeholder="Descrição"
            required
            value={newEntry.description}
            onChange={(e) => setNewEntry((s) => ({ ...s, description: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Preço em reais (BRL)"
            type="number"
            step="0.01"
            value={newEntry.priceBRL}
            onChange={(e) => setNewEntry((s) => ({ ...s, priceBRL: e.target.value }))}
            className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Preço em dólar (USD)"
            type="number"
            step="0.01"
            value={newEntry.priceUSD}
            onChange={(e) => setNewEntry((s) => ({ ...s, priceUSD: e.target.value }))}
            className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createEntry.isPending}
            className="col-span-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Adicionar item
          </button>
        </form>
      )}

      {isLoading && <p className="mt-6 text-neutral-400">Carregando…</p>}

      <div className="mt-6 space-y-6">
        {grouped.map(([sector, items]) => (
          <div key={sector} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{sector}</h3>
            </div>
            <table className="min-w-full divide-y divide-neutral-100 text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">SKU</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Descrição</th>
                  {showBRL && <th className="px-4 py-2 text-left font-medium text-neutral-500">Preço BRL</th>}
                  {showUSD && <th className="px-4 py-2 text-left font-medium text-neutral-500">Preço USD</th>}
                  {isAdmin && <th className="px-4 py-2 text-right font-medium text-neutral-500">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 font-medium text-ink-900">{entry.sku}</td>
                    <td className="px-4 py-2 text-neutral-600">{entry.description}</td>
                    {showBRL && <td className="px-4 py-2 text-ink-900">{formatPrice(entry.priceBRL, 'BRL')}</td>}
                    {showUSD && <td className="px-4 py-2 text-ink-900">{formatPrice(entry.priceUSD, 'USD')}</td>}
                    {isAdmin && (
                      <td className="px-4 py-2 text-right space-x-2">
                        <button
                          onClick={() => {
                            const brl = window.prompt('Novo preço em BRL (deixe vazio para manter):', entry.priceBRL ?? '')
                            const usd = window.prompt('Novo preço em USD (deixe vazio para manter):', entry.priceUSD ?? '')
                            updatePrice.mutate({
                              id: entry.id,
                              priceBRL: brl ? Number(brl) : entry.priceBRL ? Number(entry.priceBRL) : null,
                              priceUSD: usd ? Number(usd) : entry.priceUSD ? Number(entry.priceUSD) : null,
                            })
                          }}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removeEntry.mutate(entry.id)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!isLoading && grouped.length === 0 && (
          <p className="text-neutral-400">Nenhum item encontrado.</p>
        )}
      </div>
    </div>
  )
}
