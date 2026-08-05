import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type { ProductDTO, ProductKind, SectorDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { DropZone } from '../components/DropZone'
import { EmptyState } from '../components/EmptyState'
import { IconBox, IconSearch } from '../components/icons'
import { localize, localizeSector } from '../lib/catalogTranslation'
import {
  ProductFieldSet,
  emptyProductForm,
  productFormToPayload,
  type ProductFormState,
} from '../components/ProductFieldSet'

async function fetchProducts(search: string) {
  const { data } = await api.get<{ products: ProductDTO[] }>('/products', {
    params: { search: search || undefined },
  })
  return data.products
}

async function fetchSectors() {
  const { data } = await api.get<{ sectors: string[] }>('/products/sectors')
  return data.sectors
}

async function fetchSectorList() {
  const { data } = await api.get<{ sectors: SectorDTO[] }>('/sectors')
  return data.sectors
}

const kindLabel: Record<ProductKind, string> = {
  COMPLETE_MODEL: 'Modelo completo',
  COMPONENT: 'Componente / peça',
}

export function Products() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<ProductKind | 'ALL'>('ALL')
  const [sectorFilter, setSectorFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<ProductDTO | null>(null)
  const [customizationDraft, setCustomizationDraft] = useState({ name: '', options: '' })

  const [editForm, setEditForm] = useState<ProductFormState>(emptyProductForm)

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['products', search],
    queryFn: () => fetchProducts(search),
  })

  const { data: sectors } = useQuery({ queryKey: ['product-sectors'], queryFn: fetchSectors })
  const { data: sectorList } = useQuery({ queryKey: ['sector-list'], queryFn: fetchSectorList })
  const lang = user?.catalogLanguage ?? 'EN'

  const filteredProducts = products?.filter(
    (p) =>
      (kindFilter === 'ALL' || p.kind === kindFilter) && (sectorFilter === 'ALL' || p.sectors.includes(sectorFilter)),
  )

  useEffect(() => {
    if (!highlightId || !products?.some((p) => p.id === highlightId)) return
    setExpandedId(highlightId)
    setEditingId(null)
    const el = document.getElementById(`product-${highlightId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('highlight')
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, products])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] })

  const updateProduct = useMutation({
    mutationFn: async (id: string) => {
      const payload = productFormToPayload(editForm)
      await api.patch(`/products/${id}`, {
        ...payload,
        weightKg: payload.weightKg ?? null,
        priceBRL: payload.priceBRL ?? null,
        priceUSD: payload.priceUSD ?? null,
        priceEUR: payload.priceEUR ?? null,
        priceUSDDistributor: payload.priceUSDDistributor ?? null,
      })
    },
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['product-sectors'] })
      setEditingId(null)
    },
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      invalidate()
      setDeletingProduct(null)
    },
  })

  const uploadMedia = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/products/${id}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: invalidate,
  })

  const removeMedia = useMutation({
    mutationFn: async ({ productId, mediaId }: { productId: string; mediaId: string }) =>
      api.delete(`/products/${productId}/media/${mediaId}`),
    onSuccess: invalidate,
  })

  const setPrimaryMedia = useMutation({
    mutationFn: async ({ productId, mediaId }: { productId: string; mediaId: string }) =>
      api.post(`/products/${productId}/media/${mediaId}/primary`),
    onSuccess: invalidate,
  })

  const uploadBrochure = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/products/${id}/brochures`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: invalidate,
  })

  const removeBrochure = useMutation({
    mutationFn: async ({ productId, brochureId }: { productId: string; brochureId: string }) =>
      api.delete(`/products/${productId}/brochures/${brochureId}`),
    onSuccess: invalidate,
  })

  const addCustomization = useMutation({
    mutationFn: async (productId: string) => {
      await api.post(`/products/${productId}/customizations`, {
        name: customizationDraft.name,
        options: customizationDraft.options.split(',').map((o) => o.trim()).filter(Boolean),
      })
    },
    onSuccess: () => {
      invalidate()
      setCustomizationDraft({ name: '', options: '' })
    },
  })

  const removeCustomization = useMutation({
    mutationFn: async ({ productId, customizationId }: { productId: string; customizationId: string }) =>
      api.delete(`/products/${productId}/customizations/${customizationId}`),
    onSuccess: invalidate,
  })

  function startEdit(product: ProductDTO) {
    setEditingId(product.id)
    setExpandedId(null)
    setEditForm({
      sku: product.sku,
      name: product.name,
      sectors: product.sectors,
      videoLinks: product.videoLinks,
      kind: product.kind,
      description: product.description ?? '',
      descriptionPt: product.descriptionPt ?? '',
      components: product.components ?? '',
      componentsPt: product.componentsPt ?? '',
      weightKg: product.weightKg ?? '',
      priceBRL: product.priceBRL ?? '',
      priceUSD: product.priceUSD ?? '',
      priceEUR: product.priceEUR ?? '',
      priceUSDDistributor: product.priceUSDDistributor ?? '',
    })
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Produtos</h1>
          <p className="mt-1 text-neutral-500">
            Catálogo de produtos Pro Delphus — cadastrar aqui já adiciona à tabela de preços.
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/produtos/novo"
            className="mt-7 shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
          >
            + Criar novo produto
          </Link>
        )}
      </div>

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
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-sm">
          {(['ALL', 'COMPLETE_MODEL', 'COMPONENT'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                kindFilter === k ? 'bg-ink-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              {k === 'ALL' ? 'Todos os tipos' : kindLabel[k]}
            </button>
          ))}
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors hover:border-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="ALL">Todos os setores</option>
          {sectors?.map((s) => (
            <option key={s} value={s}>
              {localizeSector(s, sectorList, lang)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                <div className="skeleton h-12 w-12 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}
        {isError && (
          <p className="text-brand-600">
            Não foi possível carregar os produtos. Verifique sua conexão e tente novamente.
          </p>
        )}
        {!isLoading && !isError && filteredProducts?.length === 0 && (
          <EmptyState
            icon={IconBox}
            title="Nenhum produto encontrado"
            description={search || sectorFilter !== 'ALL' || kindFilter !== 'ALL' ? 'Tente ajustar os filtros.' : 'Ainda não há produtos cadastrados.'}
          />
        )}
        {filteredProducts?.map((product, index) => {
          const primaryMedia = product.media.find((m) => m.isPrimary)
          const isEditing = editingId === product.id
          return (
            <div
              key={product.id}
              id={`product-${product.id}`}
              className="animate-fade-in-up scroll-mt-6 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
              style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {primaryMedia ? (
                    <img src={primaryMedia.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-300">
                      <IconBox className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-ink-900">
                      {product.name} <span className="text-neutral-400">— {product.sku}</span>
                    </p>
                    <p className="text-sm text-neutral-500">
                      {product.sectors.map((s) => localizeSector(s, sectorList, lang)).join(', ')} ·{' '}
                      {kindLabel[product.kind]}
                      {product.weightKg && ` · ${product.weightKg} kg`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setExpandedId(expandedId === product.id ? null : product.id)
                      setEditingId(null)
                    }}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    {expandedId === product.id ? 'Fechar' : 'Detalhes'}
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => (isEditing ? setEditingId(null) : startEdit(product))}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        {isEditing ? 'Cancelar' : 'Editar'}
                      </button>
                      <button
                        onClick={() => setDeletingProduct(product)}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    updateProduct.mutate(product.id)
                  }}
                  className="animate-fade-in-up mt-4 grid grid-cols-4 gap-x-4 gap-y-5 border-t border-neutral-100 pt-5"
                >
                  <ProductFieldSet value={editForm} onChange={(patch) => setEditForm((s) => ({ ...s, ...patch }))} sectors={sectors ?? []} />
                  <button
                    type="submit"
                    disabled={updateProduct.isPending}
                    className="col-span-4 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-black active:scale-[0.99] disabled:opacity-60"
                  >
                    {updateProduct.isPending ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </form>
              )}

              {expandedId === product.id && (
                <div className="animate-fade-in-up mt-4 space-y-5 border-t border-neutral-100 pt-5">
                  <dl className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Descrição</dt>
                      <dd className="mt-1 text-sm text-neutral-600">
                        {localize(product.description, product.descriptionPt, lang) ?? 'Sem descrição cadastrada.'}
                      </dd>
                    </div>
                    {product.kind === 'COMPLETE_MODEL' && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Componentes</dt>
                        <dd className="mt-1 text-sm text-neutral-600">
                          {localize(product.components, product.componentsPt, lang) ?? 'Sem componentes cadastrados.'}
                        </dd>
                      </div>
                    )}
                    {product.videoLinks.length > 0 && (
                      <div className="lg:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                          Links de vídeo
                        </dt>
                        <dd className="mt-1">
                          <ul className="space-y-0.5">
                            {product.videoLinks.map((link) => (
                              <li key={link} className="truncate">
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-brand-600 underline"
                                >
                                  {link}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-neutral-200 p-3">
                      <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Mídia</h3>
                      {product.media.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {product.media.map((m) => (
                            <div key={m.id} className="relative">
                              {m.type === 'IMAGE' ? (
                                <img
                                  src={m.url}
                                  alt=""
                                  className={`h-16 w-16 rounded object-cover ${
                                    m.isPrimary ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                                  }`}
                                />
                              ) : (
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-brand-600 underline"
                                >
                                  arquivo
                                </a>
                              )}
                              {isAdmin && m.type === 'IMAGE' && !m.isPrimary && (
                                <button
                                  onClick={() => setPrimaryMedia.mutate({ productId: product.id, mediaId: m.id })}
                                  title="Tornar principal"
                                  className="absolute bottom-0 left-0 rounded-tr-md bg-ink-900/80 px-1 text-[9px] font-medium text-white"
                                >
                                  ★
                                </button>
                              )}
                              {m.isPrimary && (
                                <span className="absolute bottom-0 left-0 rounded-tr-md bg-brand-600 px-1 text-[9px] font-medium text-white">
                                  Principal
                                </span>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => removeMedia.mutate({ productId: product.id, mediaId: m.id })}
                                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {product.media.length === 0 && !isAdmin && (
                        <p className="text-sm text-neutral-400">Nenhuma mídia cadastrada.</p>
                      )}
                      {isAdmin && (
                        <DropZone
                          accept="image/*"
                          multiple
                          className="py-2"
                          onFiles={(files) => files.forEach((file) => uploadMedia.mutate({ id: product.id, file }))}
                        >
                          <p className="text-xs text-neutral-500">
                            Arraste imagens aqui ou{' '}
                            <span className="font-medium text-brand-600">clique para selecionar</span>
                          </p>
                        </DropZone>
                      )}
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3">
                      <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Brochuras</h3>
                      {product.brochures.length > 0 && (
                        <ul className="mb-3 space-y-1">
                          {product.brochures.map((b) => (
                            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                              <a
                                href={b.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-brand-600 underline"
                              >
                                {b.name}
                              </a>
                              {isAdmin && (
                                <button
                                  onClick={() => removeBrochure.mutate({ productId: product.id, brochureId: b.id })}
                                  className="shrink-0 text-xs text-neutral-400 hover:text-brand-600"
                                >
                                  remover
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {product.brochures.length === 0 && !isAdmin && (
                        <p className="text-sm text-neutral-400">Nenhuma brochura enviada.</p>
                      )}
                      {isAdmin && (
                        <DropZone
                          accept=".pdf,application/pdf"
                          multiple
                          className="py-2"
                          onFiles={(files) => files.forEach((file) => uploadBrochure.mutate({ id: product.id, file }))}
                        >
                          <p className="text-xs text-neutral-500">
                            Arraste PDFs aqui ou{' '}
                            <span className="font-medium text-brand-600">clique para selecionar</span>
                          </p>
                        </DropZone>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Customizações</h3>
                    {product.customizations.length > 0 && (
                      <ul className="mb-3 space-y-1">
                        {product.customizations.map((c) => (
                          <li key={c.id} className="flex items-center justify-between text-sm">
                            <span>
                              <strong>{c.name}:</strong> {Array.isArray(c.options) ? c.options.join(', ') : ''}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() =>
                                  removeCustomization.mutate({ productId: product.id, customizationId: c.id })
                                }
                                className="text-xs text-brand-600 hover:underline"
                              >
                                remover
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {product.customizations.length === 0 && !isAdmin && (
                      <p className="text-sm text-neutral-400">Nenhuma customização cadastrada.</p>
                    )}
                    {isAdmin && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          addCustomization.mutate(product.id)
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          placeholder="Nome (ex: Cor)"
                          required
                          value={customizationDraft.name}
                          onChange={(e) => setCustomizationDraft((s) => ({ ...s, name: e.target.value }))}
                          className="w-40 min-w-0 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
                        />
                        <input
                          placeholder="Opções separadas por vírgula"
                          required
                          value={customizationDraft.options}
                          onChange={(e) => setCustomizationDraft((s) => ({ ...s, options: e.target.value }))}
                          className="min-w-40 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Adicionar
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {deletingProduct && (
        <ConfirmDeleteModal
          title={`Excluir "${deletingProduct.name}"?`}
          description="Se o produto já tiver orçamentos vinculados, ele será apenas desativado em vez de excluído."
          isPending={deleteProduct.isPending}
          onCancel={() => setDeletingProduct(null)}
          onConfirm={() => deleteProduct.mutate(deletingProduct.id)}
        />
      )}
    </div>
  )
}
