import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SectorDTO } from '@prodelphusplus/shared'
import { api } from '../../lib/api'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import {
  Button,
  ButtonLink,
  EmptyState,
  Input,
  Page,
  SearchField,
  SegmentedControl,
  SkeletonRows,
  TBody,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Toolbar,
  Tr,
} from '../../components/ui'
import { IconAlert, IconLayers, IconPlus } from '../../components/icons'

async function fetchSectors() {
  const { data } = await api.get<{ sectors: SectorDTO[] }>('/sectors')
  return data.sectors
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

  // O filtro controla quais COLUNAS de nome aparecem — a busca sempre olha as duas.
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
    <Page
      title="Setores"
      description="Gerencie os setores usados no catálogo de produtos e na tabela de preços."
      actions={
        <ButtonLink to="/admin/setores/novo" variant="primary" size="sm">
          <IconPlus className="h-4 w-4" />
          Novo setor
        </ButtonLink>
      }
    >
      {error && (
        <div className="animate-fade-in mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          <IconAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Toolbar className="mb-4">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar setor" className="w-full sm:w-72" />
        <SegmentedControl
          aria-label="Colunas visíveis"
          value={columnFilter}
          onChange={setColumnFilter}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'EN', label: 'Nome em inglês' },
            { value: 'PT', label: 'Nome em português' },
          ]}
        />
      </Toolbar>

      <TableShell>
        <Table>
          <THead>
            <tr>
              {showEnColumn && <Th>Nome (inglês)</Th>}
              {showPtColumn && <Th>Nome (português)</Th>}
              <Th align="right">Produtos</Th>
              <Th align="right">Ações</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading && <SkeletonRows rows={5} columns={totalColumns} />}

            {isError && (
              <tr>
                <td colSpan={totalColumns} className="px-4 py-6 text-center text-sm text-brand-600">
                  Não foi possível carregar os setores.
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              filteredSectors.map((sector) => (
                <Tr key={sector.id}>
                  {editingId === sector.id ? (
                    <td colSpan={nameColumnCount} className="px-4 py-2">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          updateSector.mutate(sector.id)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          autoFocus
                          required
                          placeholder="Nome em inglês"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 flex-1 text-[13px]"
                        />
                        <Input
                          placeholder="Nome em português (opcional)"
                          value={editNamePt}
                          onChange={(e) => setEditNamePt(e.target.value)}
                          className="h-9 flex-1 text-[13px]"
                        />
                        <Button type="submit" size="sm" variant="primary" disabled={updateSector.isPending}>
                          Salvar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </form>
                    </td>
                  ) : (
                    <>
                      {showEnColumn && <Td className="font-medium text-ink-900">{sector.name}</Td>}
                      {showPtColumn && <Td>{sector.namePt || '—'}</Td>}
                    </>
                  )}
                  <Td className="tabular text-right text-neutral-500">{sector.productCount}</Td>
                  <Td className="text-right">
                    {editingId !== sector.id && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => startEdit(sector)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingSector(sector)}
                          className="text-neutral-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          Excluir
                        </Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>

        {!isLoading && !isError && filteredSectors.length === 0 && (
          <EmptyState
            icon={IconLayers}
            title={search ? 'Nenhum setor encontrado' : 'Nenhum setor cadastrado'}
            description={search ? 'Tente ajustar a busca.' : 'Crie o primeiro setor para organizar o catálogo.'}
          />
        )}
      </TableShell>

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
    </Page>
  )
}
