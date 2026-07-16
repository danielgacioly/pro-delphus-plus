import type { ProductKind } from '@prodelphusplus/shared'

export const emptyProductForm = {
  sku: '',
  name: '',
  sector: '',
  kind: 'COMPLETE_MODEL' as ProductKind,
  description: '',
  weightKg: '',
  priceBRL: '',
  priceUSD: '',
  priceUSDDistributor: '',
}

export type ProductFormState = typeof emptyProductForm

export function productFormToPayload(form: ProductFormState) {
  return {
    sku: form.sku,
    name: form.name,
    sector: form.sector,
    kind: form.kind,
    description: form.description || undefined,
    weightKg: form.weightKg ? Number(form.weightKg) : undefined,
    priceBRL: form.priceBRL ? Number(form.priceBRL) : undefined,
    priceUSD: form.priceUSD ? Number(form.priceUSD) : undefined,
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
  return (
    <>
      <input
        placeholder="SKU"
        required
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
      <input
        placeholder="Setor (ex: Spine)"
        required
        list="sectors-datalist"
        value={value.sector}
        onChange={(e) => onChange({ sector: e.target.value })}
        className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
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
