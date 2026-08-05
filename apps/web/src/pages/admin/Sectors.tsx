import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { SectorDTO } from '@prodelphusplus/shared'
import { api } from '../../lib/api'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import { EmptyState } from '../../components/EmptyState'
import { IconAlert, IconLayers, IconSearch } from '../../components/icons'

async function fetchSectors() {
  const { data } = await api.get<{ sectors: SectorDTO[] }>('/sectors')
  return data.sectors
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="skeleton h-3 w-full max-w-28 rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function AdminSectors() {
  const queryClient = useQueryClient()
  const { data: sectors, isLoading, isError } = useQuery({ queryKey: ['sectors'], queryFn: fetchSectors })

  const [search, setSearch] = useState('')
  const [columnFilter, setColumnFilter] = useState<'ALL' | 'EN' | 'PT'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNamePt, setEditNamePt] = useState('')
  const [deletingSector, setDeletingSector] = useState<SectorDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredSectors = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sectors ?? []
    return (sectors ?? []).filter(
      (s) => s.name.toLowerCase().includes(q) || (s.namePt ?? '').toLowerCase().includes(q),
    )
  }, [sectors, search])

  const showEnColumn = columnFilter !== 'PT'
  const showPtColumn = columnFilter !== 'EN'
  const nameColumnCount = showEnColumn && showPtColumn ? 2 : 1
  const totalColumns = nameColumnCount + 2

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sectors'] })
    queryClient.invalidateQueries({ queryKey: ['product-sectors'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['products-price-table'] })
  }

  function extractError(err: unknown, fallback: string) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  }

  const updateSector = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/sectors/${id}`, { name: editName.trim(), namePt: editNamePt.trim() || null }),
    onSuccess: () => {
      invalidate()
      setEditingId(null)
      setError(null)
    },
    onError: (err: unknown) => setError(extractError(err, 'Não foi possível renomear o setor.')),
  })

  const deleteSector = useMutation({
    mutationFn: async (id: string) => api.delete(`/sectors/${id}`),
    onSuccess: () => {
      invalidate()
      setDeletingSector(null)
      setError(null)
    },
    onError: (err: unknown) => {
      setError(extractError(err, 'Não foi possível excluir o setor.'))
      setDeletingSector(null)
    },
  })

  function startEdit(sector: SectorDTO) {
    setEditingId(sector.id)
    setEditName(sector.name)
    setEditNamePt(sector.namePt ?? '')
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Setores</h1>
          <p className="mt-1 text-neutral-500">
            Gerencie os setores usados no catálogo de produtos e na tabela de preços.
          </p>
        </div>
        <Link
          to="/admin/setores/novo"
          className="mt-7 shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
        >
          + Novo setor
        </Link>
      </div>

      {error && (
        <div className="animate-fade-in-up mt-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <IconAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Buscar setor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm transition-shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-sm">
          {(
            [
              { key: 'ALL', label: 'Todos' },
              { key: 'EN', label: 'Nome em inglês' },
              { key: 'PT', label: 'Nome em português' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setColumnFilter(opt.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                columnFilter === opt.key ? 'bg-ink-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {showEnColumn && <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Nome (inglês)</th>}
                {showPtColumn && <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Nome (português)</th>}
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Produtos</th>
                <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading && <SkeletonRows columns={totalColumns} />}
              {isError && (
                <tr>
                  <td colSpan={totalColumns} className="px-4 py-4 text-center text-brand-600">
                    Não foi possível carregar os setores.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                filteredSectors.map((sector, index) => (
                  <tr
                    key={sector.id}
                    className="animate-fade-in-up transition-colors hover:bg-neutral-50"
                    style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                  >
                    {editingId === sector.id ? (
                      <td colSpan={nameColumnCount} className="px-4 py-2 text-ink-900">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            updateSector.mutate(sector.id)
                          }}
                          className="flex gap-2"
                        >
                          <input
                            autoFocus
                            required
                            placeholder="Nome em inglês"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                          <input
                            placeholder="Nome em português (opcional)"
                            value={editNamePt}
                            onChange={(e) => setEditNamePt(e.target.value)}
                            className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                          <button
                            type="submit"
                            disabled={updateSector.isPending}
                            className="rounded-lg bg-ink-900 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-black active:scale-95 disabled:opacity-60"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs font-medium text-neutral-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </form>
                      </td>
                    ) : (
                      <>
                        {showEnColumn && <td className="px-4 py-2.5 font-medium text-ink-900">{sector.name}</td>}
                        {showPtColumn && <td className="px-4 py-2.5 text-neutral-600">{sector.namePt || '—'}</td>}
                      </>
                    )}
                    <td className="px-4 py-2.5 text-neutral-600">{sector.productCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      {editingId !== sector.id && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => startEdit(sector)}
                            className="text-xs font-semibold text-brand-600 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeletingSector(sector)}
                            className="text-xs font-semibold text-brand-600 hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && filteredSectors.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={IconLayers}
              title={search ? 'Nenhum setor encontrado para essa busca' : 'Nenhum setor cadastrado'}
            />
          </div>
        )}
      </div>

      {deletingSector && (
        <ConfirmDeleteModal
          title={`Excluir "${deletingSector.name}"?`}
          description={
            deletingSector.productCount > 0
              ? `Este setor tem ${deletingSector.productCount} produto(s) vinculado(s). Mova ou exclua esses produtos antes de remover o setor.`
              : 'Esta ação não pode ser desfeita.'
          }
          isPending={deleteSector.isPending}
          onCancel={() => setDeletingSector(null)}
          onConfirm={() => deleteSector.mutate(deletingSector.id)}
        />
      )}
    </div>
  )
}
