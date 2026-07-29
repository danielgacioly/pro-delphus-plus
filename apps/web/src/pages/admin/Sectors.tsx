import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { SectorDTO } from '@prodelphusplus/shared'
import { api } from '../../lib/api'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'

async function fetchSectors() {
  const { data } = await api.get<{ sectors: SectorDTO[] }>('/sectors')
  return data.sectors
}

export function AdminSectors() {
  const queryClient = useQueryClient()
  const { data: sectors, isLoading, isError } = useQuery({ queryKey: ['sectors'], queryFn: fetchSectors })

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingSector, setDeletingSector] = useState<SectorDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredSectors = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sectors ?? []
    return (sectors ?? []).filter((s) => s.name.toLowerCase().includes(q))
  }, [sectors, search])

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
    mutationFn: async (id: string) => api.patch(`/sectors/${id}`, { name: editName.trim() }),
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
          className="mt-7 shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Novo setor
        </Link>
      </div>

      {error && <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>}

      <input
        placeholder="Buscar setor"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-72 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Nome</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Produtos</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-neutral-400">
                  Carregando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-brand-600">
                  Não foi possível carregar os setores.
                </td>
              </tr>
            )}
            {!isLoading && !isError && filteredSectors.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-neutral-400">
                  {search ? 'Nenhum setor encontrado para essa busca.' : 'Nenhum setor cadastrado.'}
                </td>
              </tr>
            )}
            {filteredSectors.map((sector) => (
              <tr key={sector.id}>
                <td className="px-4 py-2 text-ink-900">
                  {editingId === sector.id ? (
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
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={updateSector.isPending}
                        className="rounded-lg bg-ink-900 px-3 py-1 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
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
                  ) : (
                    sector.name
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-600">{sector.productCount}</td>
                <td className="px-4 py-2 text-right">
                  {editingId !== sector.id && (
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => startEdit(sector)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingSector(sector)}
                        className="text-xs font-medium text-brand-600 hover:underline"
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
