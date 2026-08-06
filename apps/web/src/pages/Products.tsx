import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import type { ProductDTO, ProductKind, SectorDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import { DropZone } from '../components/DropZone'
import { localize, localizeSector } from '../lib/catalogTranslation'
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Input,
  Page,
  SearchField,
  SegmentedControl,
  Select,
  Skeleton,
  Toolbar,
} from '../components/ui'
import { IconBox, IconChevronDown, IconPlus } from '../components/icons'
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

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-eyebrow text-neutral-400">{label}</dt>
      <dd className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600">{children}</dd>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
      <h3 className="text-eyebrow mb-3 text-neutral-500">{title}</h3>
      {children}
    </div>
  )
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

  const hasFilters = Boolean(search) || sectorFilter !== 'ALL' || kindFilter !== 'ALL'

  return (
    <Page
      title="Produtos"
      description="Catálogo Pro Delphus — cadastrar aqui já adiciona o item à tabela de preços."
      actions={
        isAdmin && (
          <ButtonLink to="/produtos/novo" variant="primary" size="sm">
            <IconPlus className="h-4 w-4" />
            Novo produto
          </ButtonLink>
        )
      }
    >
      <Toolbar className="mb-5">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar produtos"
          className="w-full sm:w-64"
        />
        <SegmentedControl
          aria-label="Tipo de produto"
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'COMPLETE_MODEL', label: 'Modelos' },
            { value: 'COMPONENT', label: 'Componentes' },
          ]}
        />
        <Select
          aria-label="Setor"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          auto
          className="h-9 text-[13px]"
        >
          <option value="ALL">Todos os setores</option>
          {sectors?.map((s) => (
            <option key={s} value={s}>
              {localizeSector(s, sectorList, lang)}
            </option>
          ))}
        </Select>
        {filteredProducts && !isLoading && (
          <span className="tabular ml-auto text-[13px] text-neutral-400">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
          </span>
        )}
      </Toolbar>

      {isLoading && (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm"
            >
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
          Não foi possível carregar os produtos. Verifique sua conexão e tente novamente.
        </div>
      )}

      {!isLoading && !isError && filteredProducts?.length === 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <EmptyState
            icon={IconBox}
            title="Nenhum produto encontrado"
            description={hasFilters ? 'Tente ajustar os filtros.' : 'Ainda não há produtos cadastrados.'}
          />
        </div>
      )}

      <div className="space-y-2.5">
        {filteredProducts?.map((product, index) => {
          const primaryMedia = product.media.find((m) => m.isPrimary)
          const isEditing = editingId === product.id
          const isExpanded = expandedId === product.id
          const open = isEditing || isExpanded

          return (
            <div
              key={product.id}
              id={`product-${product.id}`}
              style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
              className={cn(
                'animate-fade-in-up scroll-mt-20 rounded-2xl border bg-white shadow-sm',
                'transition-[box-shadow,border-color] duration-200',
                open ? 'border-neutral-300 shadow-md' : 'border-neutral-200/70 hover:border-neutral-300 hover:shadow-md',
              )}
            >
              <div className="flex items-center gap-4 p-4">
                {primaryMedia ? (
                  <img
                    src={primaryMedia.url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl border border-neutral-200/70 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-500/8 text-neutral-300">
                    <IconBox className="h-6 w-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-ink-900">{product.name}</p>
                    <span className="tabular shrink-0 text-[12.5px] text-neutral-400">{product.sku}</span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-neutral-500">
                    <Badge tone={product.kind === 'COMPLETE_MODEL' ? 'brand' : 'neutral'}>
                      {kindLabel[product.kind]}
                    </Badge>
                    <span className="truncate">
                      {product.sectors.map((s) => localizeSector(s, sectorList, lang)).join(' · ')}
                    </span>
                    {product.weightKg && <span className="tabular shrink-0">· {product.weightKg} kg</span>}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isAdmin && (
                    <>
                      <Button size="sm" onClick={() => (isEditing ? setEditingId(null) : startEdit(product))}>
                        {isEditing ? 'Cancelar' : 'Editar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingProduct(product)}
                        className="text-neutral-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        Excluir
                      </Button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : product.id)
                      setEditingId(null)
                    }}
                    aria-label={isExpanded ? 'Fechar detalhes' : 'Ver detalhes'}
                    aria-expanded={isExpanded}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-neutral-500/10 hover:text-ink-900 active:scale-90"
                  >
                    <IconChevronDown
                      className={cn('h-4 w-4 transition-transform duration-300 ease-out', isExpanded && 'rotate-180')}
                    />
                  </button>
                </div>
              </div>

              {isEditing && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    updateProduct.mutate(product.id)
                  }}
                  className="animate-fade-in border-t border-neutral-200/70 p-5"
                >
                  <div className="grid grid-cols-4 gap-x-4 gap-y-5">
                    <ProductFieldSet
                      value={editForm}
                      onChange={(patch) => setEditForm((s) => ({ ...s, ...patch }))}
                      sectors={sectors ?? []}
                    />
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button type="button" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={updateProduct.isPending}>
                      {updateProduct.isPending ? 'Salvando…' : 'Salvar alterações'}
                    </Button>
                  </div>
                </form>
              )}

              {isExpanded && (
                <div className="animate-fade-in space-y-5 border-t border-neutral-200/70 p-5">
                  <dl className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <DetailBlock label="Descrição">
                      {localize(product.description, product.descriptionPt, lang) ?? 'Sem descrição cadastrada.'}
                    </DetailBlock>
                    {product.kind === 'COMPLETE_MODEL' && (
                      <DetailBlock label="Componentes">
                        {localize(product.components, product.componentsPt, lang) ?? 'Sem componentes cadastrados.'}
                      </DetailBlock>
                    )}
                    {product.videoLinks.length > 0 && (
                      <div className="lg:col-span-2">
                        <dt className="text-eyebrow text-neutral-400">Links de vídeo</dt>
                        <dd className="mt-1.5 space-y-1">
                          {product.videoLinks.map((link) => (
                            <a
                              key={link}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-[13px] text-brand-600 hover:underline"
                            >
                              {link}
                            </a>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Panel title="Mídia">
                      {product.media.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2.5">
                          {product.media.map((m) => (
                            <div key={m.id} className="group relative">
                              {m.type === 'IMAGE' ? (
                                <img
                                  src={m.url}
                                  alt=""
                                  className={cn(
                                    'h-17 w-17 rounded-lg border border-neutral-200/70 object-cover',
                                    m.isPrimary && 'ring-2 ring-brand-500 ring-offset-2',
                                  )}
                                />
                              ) : (
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-17 w-17 items-center justify-center rounded-lg border border-neutral-200 bg-white text-[11px] text-brand-600"
                                >
                                  arquivo
                                </a>
                              )}
                              {m.isPrimary && (
                                <span className="absolute bottom-1 left-1 rounded bg-brand-600 px-1.5 py-px text-[9px] font-semibold text-white">
                                  Principal
                                </span>
                              )}
                              {isAdmin && m.type === 'IMAGE' && !m.isPrimary && (
                                <button
                                  onClick={() => setPrimaryMedia.mutate({ productId: product.id, mediaId: m.id })}
                                  title="Tornar principal"
                                  className="absolute bottom-1 left-1 rounded bg-ink-900/75 px-1.5 py-px text-[9px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  Principal
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => removeMedia.mutate({ productId: product.id, mediaId: m.id })}
                                  aria-label="Remover mídia"
                                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-[11px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {product.media.length === 0 && !isAdmin && (
                        <p className="text-[13px] text-neutral-400">Nenhuma mídia cadastrada.</p>
                      )}
                      {isAdmin && (
                        <DropZone
                          accept="image/*"
                          multiple
                          className="py-3"
                          onFiles={(files) => files.forEach((file) => uploadMedia.mutate({ id: product.id, file }))}
                        >
                          <p className="text-[12.5px] text-neutral-500">
                            Arraste imagens ou{' '}
                            <span className="font-medium text-brand-600">clique para selecionar</span>
                          </p>
                        </DropZone>
                      )}
                    </Panel>

                    <Panel title="Brochuras">
                      {product.brochures.length > 0 && (
                        <ul className="mb-3 space-y-1.5">
                          {product.brochures.map((b) => (
                            <li key={b.id} className="flex items-center justify-between gap-2">
                              <a
                                href={b.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-[13px] text-brand-600 hover:underline"
                              >
                                {b.name}
                              </a>
                              {isAdmin && (
                                <button
                                  onClick={() => removeBrochure.mutate({ productId: product.id, brochureId: b.id })}
                                  className="shrink-0 text-[12px] text-neutral-400 transition-colors hover:text-brand-600"
                                >
                                  remover
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {product.brochures.length === 0 && !isAdmin && (
                        <p className="text-[13px] text-neutral-400">Nenhuma brochura enviada.</p>
                      )}
                      {isAdmin && (
                        <DropZone
                          accept=".pdf,application/pdf"
                          multiple
                          className="py-3"
                          onFiles={(files) => files.forEach((file) => uploadBrochure.mutate({ id: product.id, file }))}
                        >
                          <p className="text-[12.5px] text-neutral-500">
                            Arraste PDFs ou <span className="font-medium text-brand-600">clique para selecionar</span>
                          </p>
                        </DropZone>
                      )}
                    </Panel>
                  </div>

                  <Panel title="Customizações">
                    {product.customizations.length > 0 && (
                      <ul className="mb-3 space-y-1.5">
                        {product.customizations.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="min-w-0 truncate text-neutral-600">
                              <strong className="font-semibold text-ink-900">{c.name}:</strong>{' '}
                              {Array.isArray(c.options) ? c.options.join(', ') : ''}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() =>
                                  removeCustomization.mutate({ productId: product.id, customizationId: c.id })
                                }
                                className="shrink-0 text-[12px] text-neutral-400 transition-colors hover:text-brand-600"
                              >
                                remover
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {product.customizations.length === 0 && !isAdmin && (
                      <p className="text-[13px] text-neutral-400">Nenhuma customização cadastrada.</p>
                    )}
                    {isAdmin && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          addCustomization.mutate(product.id)
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Input
                          placeholder="Nome (ex: Cor)"
                          required
                          value={customizationDraft.name}
                          onChange={(e) => setCustomizationDraft((s) => ({ ...s, name: e.target.value }))}
                          className="h-9 w-44 text-[13px]"
                        />
                        <Input
                          placeholder="Opções separadas por vírgula"
                          required
                          value={customizationDraft.options}
                          onChange={(e) => setCustomizationDraft((s) => ({ ...s, options: e.target.value }))}
                          className="h-9 min-w-44 flex-1 text-[13px]"
                        />
                        <Button type="submit" variant="primary" size="sm">
                          Adicionar
                        </Button>
                      </form>
                    )}
                  </Panel>
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
    </Page>
  )
}
