import { useState, type ReactNode } from 'react'
import type { ProductKind } from '@prodelphusplus/shared'

export const emptyProductForm = {
  sku: '',
  name: '',
  sectors: [] as string[],
  videoLinks: [] as string[],
  kind: 'COMPLETE_MODEL' as ProductKind,
  description: '',
  descriptionPt: '',
  components: '',
  componentsPt: '',
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
    videoLinks: form.videoLinks,
    kind: form.kind,
    description: form.description || undefined,
    descriptionPt: form.descriptionPt || undefined,
    components: form.components || undefined,
    componentsPt: form.componentsPt || undefined,
    weightKg: form.weightKg ? Number(form.weightKg) : undefined,
    priceBRL: form.priceBRL ? Number(form.priceBRL) : undefined,
    priceUSD: form.priceUSD ? Number(form.priceUSD) : undefined,
    priceEUR: form.priceEUR ? Number(form.priceEUR) : undefined,
    priceUSDDistributor: form.priceUSDDistributor ? Number(form.priceUSDDistributor) : undefined,
  }
}

const spanClass = { 1: undefined, 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4' } as const

function Field({ label, span, children }: { label: string; span?: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <div className={span ? spanClass[span] : undefined}>
      <label className="mb-1 block text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-4 mt-2 border-t border-neutral-100 pt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </div>
  )
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
  const [sectorError, setSectorError] = useState('')
  const [videoDraft, setVideoDraft] = useState('')

  function addVideoLink(raw: string) {
    const typed = raw.trim()
    if (!typed || value.videoLinks.includes(typed)) {
      setVideoDraft('')
      return
    }
    onChange({ videoLinks: [...value.videoLinks, typed] })
    setVideoDraft('')
  }

  function removeVideoLink(link: string) {
    onChange({ videoLinks: value.videoLinks.filter((l) => l !== link) })
  }

  function addSector(raw: string) {
    const typed = raw.trim()
    if (!typed) return

    const match = sectors.find((s) => s.toLowerCase() === typed.toLowerCase())
    if (!match) {
      setSectorError('Setor não encontrado. Escolha um setor já existente.')
      return
    }
    if (value.sectors.includes(match)) {
      setSectorError('')
      setSectorDraft('')
      return
    }
    onChange({ sectors: [...value.sectors, match] })
    setSectorDraft('')
    setSectorError('')
  }

  function removeSector(s: string) {
    onChange({ sectors: value.sectors.filter((x) => x !== s) })
  }

  return (
    <>
      <Field label="SKU">
        <input
          value={value.sku}
          onChange={(e) => onChange({ sku: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Nome" span={2}>
        <input
          required
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Peso (kg, opcional)">
        <input
          type="number"
          step="0.001"
          value={value.weightKg}
          onChange={(e) => onChange({ weightKg: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Tipo">
        <select
          value={value.kind}
          onChange={(e) => onChange({ kind: e.target.value as ProductKind })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="COMPLETE_MODEL">Modelo completo</option>
          <option value="COMPONENT">Componente / peça</option>
        </select>
      </Field>
      <Field label="Setores" span={3}>
        <input
          placeholder="Digite e aperte Enter para adicionar"
          list="sectors-datalist"
          value={sectorDraft}
          onChange={(e) => {
            setSectorDraft(e.target.value)
            if (sectorError) setSectorError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addSector(sectorDraft)
            }
          }}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {sectorError && <p className="mt-1 text-xs text-brand-600">{sectorError}</p>}
        {value.sectors.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
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
      </Field>
      <datalist id="sectors-datalist">
        {sectors.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Field label="Links de vídeo" span={4}>
        {value.videoLinks.length > 0 && (
          <ul className="mb-1.5 space-y-1">
            {value.videoLinks.map((link) => (
              <li
                key={link}
                className="flex items-center justify-between gap-2 rounded-lg bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
              >
                <span className="truncate">{link}</span>
                <button
                  type="button"
                  onClick={() => removeVideoLink(link)}
                  className="shrink-0 text-neutral-400 hover:text-brand-600"
                  aria-label={`Remover vídeo ${link}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          placeholder="Cole o link e aperte Enter para adicionar"
          value={videoDraft}
          onChange={(e) => setVideoDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addVideoLink(videoDraft)
            }
          }}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <SectionLabel>Descrição (opcional)</SectionLabel>
      <Field label="Em inglês" span={2}>
        <input
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Em português" span={2}>
        <input
          value={value.descriptionPt}
          onChange={(e) => onChange({ descriptionPt: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      {value.kind === 'COMPLETE_MODEL' && (
        <>
          <SectionLabel>Componentes do kit (opcional)</SectionLabel>
          <Field label="Em inglês" span={2}>
            <input
              placeholder="ex: Components: 1 MMT-0, 1 MMT-1"
              value={value.components}
              onChange={(e) => onChange({ components: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Em português" span={2}>
            <input
              value={value.componentsPt}
              onChange={(e) => onChange({ componentsPt: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </>
      )}
      <SectionLabel>Preços</SectionLabel>
      <Field label="Preço final BRL">
        <input
          type="number"
          step="0.01"
          value={value.priceBRL}
          onChange={(e) => onChange({ priceBRL: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Preço final USD">
        <input
          type="number"
          step="0.01"
          value={value.priceUSD}
          onChange={(e) => onChange({ priceUSD: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Preço final EUR">
        <input
          type="number"
          step="0.01"
          value={value.priceEUR}
          onChange={(e) => onChange({ priceEUR: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Preço distribuidor USD">
        <input
          type="number"
          step="0.01"
          value={value.priceUSDDistributor}
          onChange={(e) => onChange({ priceUSDDistributor: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>
    </>
  )
}
