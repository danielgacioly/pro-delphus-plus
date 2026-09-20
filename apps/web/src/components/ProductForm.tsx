import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProductDTO } from '@prodelphusplus/shared'
import { api, getErrorMessage } from '../lib/api'
import { DropZone } from './DropZone'
import { Alert, Button, FormSection } from './ui'
import { ProductFieldSet, emptyProductForm, productFormToPayload, type ProductFormState } from './ProductFieldSet'

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
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-800">{label}</label>
      <DropZone accept={accept} multiple onFiles={onAdd}>
        <p className="text-[12.5px] text-neutral-600">
          {hint} ou <span className="font-medium text-brand-600">clique para selecionar</span>
        </p>
      </DropZone>
      {files.length > 0 && (
        <p className="mt-1.5 text-[12px] text-neutral-600">
          {files.length} arquivo(s) selecionado(s) —{' '}
          <button type="button" onClick={onClear} className="font-medium text-brand-600 hover:underline">
            limpar
          </button>
        </p>
      )}
    </div>
  )
}

/**
 * Cadastro de produto. Vive num modal (Produtos), como o de cliente — criar
 * coisa nova não tira ninguém da lista onde ela vai aparecer.
 */
export function ProductForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
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
      onCreated()
    },
    onError: (err: unknown) => setError(getErrorMessage(err, 'Não foi possível criar o produto.')),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createProduct.mutate()
      }}
    >
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <ProductFieldSet value={form} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} sectors={sectors ?? []} />

      <FormSection title="Arquivos (opcional)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </FormSection>

      <div className="mt-6 flex justify-end gap-2 border-t border-black/[0.06] pt-5">
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={createProduct.isPending}>
          {createProduct.isPending ? 'Salvando…' : 'Adicionar produto'}
        </Button>
      </div>
    </form>
  )
}
