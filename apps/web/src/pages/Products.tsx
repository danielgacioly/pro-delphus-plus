import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProductDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

async function fetchProducts(search: string) {
  const { data } = await api.get<{ products: ProductDTO[] }>('/products', {
    params: { search: search || undefined },
  })
  return data.products
}

export function Products() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState({ sku: '', name: '', description: '', weightKg: '' })
  const [customizationDraft, setCustomizationDraft] = useState({ name: '', options: '' })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => fetchProducts(search),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] })

  const createProduct = useMutation({
    mutationFn: async () => {
      await api.post('/products', {
        ...newProduct,
        weightKg: newProduct.weightKg ? Number(newProduct.weightKg) : undefined,
      })
    },
    onSuccess: () => {
      invalidate()
      setNewProduct({ sku: '', name: '', description: '', weightKg: '' })
    },
  })

  const removeProduct = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: invalidate,
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Produtos</h1>
      <p className="mt-1 text-neutral-500">Catálogo de produtos Pro Delphus com peso, mídia e customizações.</p>

      <input
        placeholder="Buscar por SKU ou nome"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-72 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createProduct.mutate()
          }}
          className="mt-4 grid max-w-3xl grid-cols-4 gap-3 rounded-lg border border-neutral-200 bg-white p-4"
        >
          <h2 className="col-span-4 text-sm font-semibold text-neutral-700">Novo produto</h2>
          <input
            placeholder="SKU"
            required
            value={newProduct.sku}
            onChange={(e) => setNewProduct((s) => ({ ...s, sku: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Nome"
            required
            value={newProduct.name}
            onChange={(e) => setNewProduct((s) => ({ ...s, name: e.target.value }))}
            className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Peso (kg)"
            type="number"
            step="0.001"
            value={newProduct.weightKg}
            onChange={(e) => setNewProduct((s) => ({ ...s, weightKg: e.target.value }))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Descrição"
            value={newProduct.description}
            onChange={(e) => setNewProduct((s) => ({ ...s, description: e.target.value }))}
            className="col-span-4 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createProduct.isPending}
            className="col-span-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Adicionar produto
          </button>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-neutral-400">Carregando…</p>}
        {products?.map((product) => {
          const primaryMedia = product.media.find((m) => m.isPrimary)
          return (
          <div key={product.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {primaryMedia ? (
                  <img src={primaryMedia.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-neutral-100" />
                )}
                <div>
                  <p className="font-medium text-ink-900">
                    {product.name} <span className="text-neutral-400">— {product.sku}</span>
                  </p>
                  <p className="text-sm text-neutral-500">
                    {product.description} {product.weightKg && `· ${product.weightKg} kg`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  {expandedId === product.id ? 'Fechar' : 'Detalhes'}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => removeProduct.mutate(product.id)}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>

            {expandedId === product.id && (
              <div className="mt-4 grid grid-cols-2 gap-6 border-t border-neutral-100 pt-4">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Mídia</h3>
                  <div className="flex flex-wrap gap-2">
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
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
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
                  {isAdmin && (
                    <input
                      type="file"
                      className="mt-3 text-xs"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadMedia.mutate({ id: product.id, file })
                        e.target.value = ''
                      }}
                    />
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Customizações</h3>
                  <ul className="space-y-1">
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
                  {isAdmin && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        addCustomization.mutate(product.id)
                      }}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        placeholder="Nome (ex: Cor)"
                        required
                        value={customizationDraft.name}
                        onChange={(e) => setCustomizationDraft((s) => ({ ...s, name: e.target.value }))}
                        className="w-32 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                      />
                      <input
                        placeholder="Opções separadas por vírgula"
                        required
                        value={customizationDraft.options}
                        onChange={(e) => setCustomizationDraft((s) => ({ ...s, options: e.target.value }))}
                        className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
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
    </div>
  )
}
