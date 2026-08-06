import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { ProductDTO } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { DropZone } from '../components/DropZone'
import { BackLink, Button, Card, Page } from '../components/ui'
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

function FilePicker({
  label,
  accept,
  files,
  onAdd,
  onClear,
  hint,
}: {
  label: string
  accept: string
  files: File[]
  onAdd: (files: File[]) => void
  onClear: () => void
  hint: string
}) {
  return (
    <div className="col-span-4">
      <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">{label}</label>
      <DropZone accept={accept} multiple onFiles={onAdd}>
        <p className="text-[12.5px] text-neutral-500">
          {hint} ou <span className="font-medium text-brand-600">clique para selecionar</span>
        </p>
      </DropZone>
      {files.length > 0 && (
        <p className="mt-1.5 text-[12px] text-neutral-500">
          {files.length} arquivo(s) selecionado(s) —{' '}
          <button type="button" onClick={onClear} className="font-medium text-brand-600 hover:underline">
            limpar
          </button>
        </p>
      )}
    </div>
  )
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
    <Page title="Novo produto" description="Cadastrar aqui já adiciona o produto à tabela de preços." width="narrow">
      <div className="-mt-4 mb-5">
        <BackLink to="/produtos">Produtos</BackLink>
      </div>

      {error && (
        <div className="animate-fade-in mb-4 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{error}</div>
      )}

      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createProduct.mutate()
          }}
        >
          <div className="grid grid-cols-4 gap-x-4 gap-y-5">
            <ProductFieldSet
              value={form}
              onChange={(patch) => setForm((s) => ({ ...s, ...patch }))}
              sectors={sectors ?? []}
            />

            <div className="text-eyebrow col-span-4 mt-3 border-t border-neutral-200/70 pt-5 text-neutral-400">
              Arquivos (opcional)
            </div>

            <FilePicker
              label="Mídias"
              accept="image/*"
              hint="Arraste imagens"
              files={files}
              onAdd={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              onClear={() => setFiles([])}
            />

            <FilePicker
              label="Brochuras"
              accept=".pdf,application/pdf"
              hint="Arraste PDFs"
              files={brochureFiles}
              onAdd={(newFiles) => setBrochureFiles((prev) => [...prev, ...newFiles])}
              onClear={() => setBrochureFiles([])}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-neutral-200/70 pt-5">
            <Button type="button" onClick={() => navigate('/produtos')}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={createProduct.isPending}>
              {createProduct.isPending ? 'Salvando…' : 'Adicionar produto'}
            </Button>
          </div>
        </form>
      </Card>
    </Page>
  )
}
