import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import type { ProductDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { DropZone } from '../components/DropZone'
import {
  ProductFieldSet,
  emptyProductForm,
  productFormToPayload,
  type ProductFormState,
} from '../components/ProductFieldSet'

async function fetchSectors() {
  const { data } = await api.get<{ sectors: string[] }>('/products/sectors')
  return data.sectors
}

export function NewProduct() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<ProductFormState>(emptyProductForm)
  const [files, setFiles] = useState<File[]>([])
  const [brochureFiles, setBrochureFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const { data: sectors } = useQuery({ queryKey: ['product-sectors'], queryFn: fetchSectors })

  const createProduct = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ product: ProductDTO }>('/products', productFormToPayload(form))
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        await api.post(`/products/${data.product.id}/media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      for (const file of brochureFiles) {
        const formData = new FormData()
        formData.append('file', file)
        await api.post(`/products/${data.product.id}/brochures`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-price-table'] })
      queryClient.invalidateQueries({ queryKey: ['product-sectors'] })
      navigate('/produtos')
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível criar o produto.'
      setError(message)
    },
  })

  return (
    <div>
      <Link to="/produtos" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar para produtos
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink-900">Novo produto</h1>
      <p className="mt-1 text-neutral-500">Cadastrar aqui já adiciona o produto à tabela de preços.</p>

      {error && (
        <div className="mt-4 max-w-3xl rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createProduct.mutate()
        }}
        className="mt-4 grid max-w-3xl grid-cols-4 gap-x-4 gap-y-5 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <ProductFieldSet value={form} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} sectors={sectors ?? []} />

        <div className="col-span-4">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Mídias (opcional)</label>
          <DropZone accept="image/*" multiple onFiles={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}>
            <p className="text-xs text-neutral-500">
              Arraste imagens aqui ou <span className="font-medium text-brand-600">clique para selecionar</span>
            </p>
          </DropZone>
          {files.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              {files.length} arquivo(s) selecionado(s) —{' '}
              <button type="button" onClick={() => setFiles([])} className="text-brand-600 hover:underline">
                limpar
              </button>
            </p>
          )}
        </div>

        <div className="col-span-4">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Brochuras (opcional)</label>
          <DropZone
            accept=".pdf,application/pdf"
            multiple
            onFiles={(newFiles) => setBrochureFiles((prev) => [...prev, ...newFiles])}
          >
            <p className="text-xs text-neutral-500">
              Arraste PDFs aqui ou <span className="font-medium text-brand-600">clique para selecionar</span>
            </p>
          </DropZone>
          {brochureFiles.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              {brochureFiles.length} arquivo(s) selecionado(s) —{' '}
              <button type="button" onClick={() => setBrochureFiles([])} className="text-brand-600 hover:underline">
                limpar
              </button>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={createProduct.isPending}
          className="col-span-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {createProduct.isPending ? 'Salvando…' : 'Adicionar produto'}
        </button>
      </form>
    </div>
  )
}
