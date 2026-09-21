/**
 * O formato do formulário de produto e a conversão dele para o corpo da API.
 *
 * Fora do componente pelo mesmo motivo de `clientForm.model.ts`: arquivo que
 * mistura componente e não-componente quebra o fast refresh do Vite.
 */
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

// Os campos largos acompanham a grade: numa coluna só eles não "esticam"
// para 3 ou 4 trilhas inexistentes, que era o que quebrava o layout quando a
// barra lateral estava aberta.
