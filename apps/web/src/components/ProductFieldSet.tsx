import { useState } from 'react'
import type { ProductKind } from '@prodelphusplus/shared'

export const emptyProductForm = {
  sku: '',
  name: '',
  sectors: [] as string[],
  kind: 'COMPLETE_MODEL' as ProductKind,
  description: '',
  components: '',
  weightKg: '',
  priceBRL: '',
  priceUSD: '',
  priceEUR: '',
  priceUSDDistributor: '',
}

export type ProductFormState = typeof emptyProductForm

export function productFormToPayload(form: ProductFormState) {
  return {
    sku: form.sku,
    name: form.name,
    sectors: form.sectors,
    kind: form.kind,
    description: form.description || undefined,
    components: form.components || undefined,
    weightKg: form.weightKg ? Number(form.weightKg) : undefined,
    priceBRL: form.priceBRL ? Number(form.priceBRL) : undefined,
    priceUSD: form.priceUSD ? Number(form.priceUSD) : undefined,
    priceEUR: form.priceEUR ? Number(form.priceEUR) : undefined,
    priceUSDDistributor: form.priceUSDDistributor ? Number(form.priceUSDDistributor) : undefined,
  }
}

export function ProductFieldSet({
  value,
  onChange,
  sectors,
}: {
  value: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
  sectors: string[]
}) {
  const [sectorDraft, setSectorDraft] = useState('')

  function addSector(raw: string) {
    const s = raw.trim()
    if (!s || value.sectors.includes(s)) return
    onChange({ sectors: [...value.sectors, s] })
    setSectorDraft('')
  }

  function removeSector(s: string) {
    onChange({ sectors: value.sectors.filter((x) => x !== s) })
  }

  return (
    <>
      <input
        placeholder="SKU"
        value={value.sku}
        onChange={(e) => onChange({ sku: e.target.value })}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Nome"
        required
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <select
        value={value.kind}
        onChange={(e) => onChange({ kind: e.target.value as ProductKind })}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="COMPLETE_MODEL">Modelo completo</option>
        <option value="COMPONENT">Componente / peça</option>
      </select>
      <div className="col-span-2">
        {value.sectors.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {value.sectors.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSector(s)}
                  className="text-neutral-400 hover:text-brand-600"
                  aria-label={`Remover setor ${s}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            placeholder="Setor (ex: Spine)"
            list="sectors-datalist"
            value={sectorDraft}
            onChange={(e) => setSectorDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSector(sectorDraft)
              }
            }}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => addSector(sectorDraft)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Adicionar
          </button>
        </div>
      </div>
      <datalist id="sectors-datalist">
        {sectors.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <input
        placeholder="Peso em kg (opcional)"
        type="number"
        step="0.001"
        value={value.weightKg}
        onChange={(e) => onChange({ weightKg: e.target.value })}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Descrição (opcional)"
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
        className="col-span-4 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      {value.kind === 'COMPLETE_MODEL' && (
        <input
          placeholder="Componentes do kit (opcional, ex: Components: 1 MMT-0, 1 MMT-1)"
          value={value.components}
          onChange={(e) => onChange({ components: e.target.value })}
          className="col-span-4 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      )}
      <input
        placeholder="Preço final BRL"
        type="number"
        step="0.01"
        value={value.priceBRL}
        onChange={(e) => onChange({ priceBRL: e.target.value })}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Preço final USD"
        type="number"
        step="0.01"
        value={value.priceUSD}
        onChange={(e) => onChange({ priceUSD: e.target.value })}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Preço final EUR"
        type="number"
        step="0.01"
        value={value.priceEUR}
        onChange={(e) => onChange({ priceEUR: e.target.value })}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Preço distribuidor USD"
        type="number"
        step="0.01"
        value={value.priceUSDDistributor}
        onChange={(e) => onChange({ priceUSDDistributor: e.target.value })}
        className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
    </>
  )
}
