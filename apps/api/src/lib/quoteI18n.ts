import { defaultQuoteNotes } from '@prodelphusplus/shared'

export type QuoteLanguage = 'PT' | 'EN' | 'ES'
export type ExportScope = 'NATIONAL' | 'INTERNATIONAL'

// Texto padrão de comentários vive em @prodelphusplus/shared — o front
// precisa dele também, para pré-preencher o campo em vez de deixar vazio.
export { defaultQuoteNotes }

export const LOCALE_BY_LANGUAGE: Record<QuoteLanguage, string> = {
  PT: 'pt-BR',
  EN: 'en-US',
  ES: 'es-ES',
}

export const LABELS: Record<QuoteLanguage, {
  quote: string
  to: string
  item: string
  qty: string
  description: string
  /** Rótulo da lista de componentes, impressa junto da descrição do item. */
  components: string
  photo: string
  unitPrice: string
  specialPrice: string
  total: string
  shipping: string
  discount: string
  toBeDefined: string
  /** Cargo padrão na assinatura automática, quando o usuário não tem um cadastrado. */
  defaultJobTitle: string
}> = {
  PT: {
    quote: 'Orçamento',
    to: 'Para',
    item: 'Item',
    qty: 'Qtd.',
    description: 'Descrição',
    components: 'Componentes',
    photo: 'Foto',
    unitPrice: 'Preço unit.',
    specialPrice: 'Preço especial',
    total: 'Total',
    shipping: 'Frete',
    discount: 'Desconto',
    toBeDefined: 'A definir',
    defaultJobTitle: 'Assistente de Vendas',
  },
  EN: {
    quote: 'Quote',
    to: 'To',
    item: 'Item',
    qty: 'Qty.',
    description: 'Description',
    components: 'Components',
    photo: 'Photo',
    unitPrice: 'Unit Price',
    specialPrice: 'Special Price',
    total: 'Total',
    shipping: 'Shipping',
    discount: 'Discount',
    toBeDefined: 'To be defined',
    defaultJobTitle: 'Sales Assistant',
  },
  ES: {
    quote: 'Presupuesto',
    to: 'Para',
    item: 'Ítem',
    qty: 'Cant.',
    description: 'Descripción',
    components: 'Componentes',
    photo: 'Foto',
    unitPrice: 'Precio unit.',
    specialPrice: 'Precio especial',
    total: 'Total',
    shipping: 'Envío',
    discount: 'Descuento',
    toBeDefined: 'Por definir',
    defaultJobTitle: 'Asistente de Ventas',
  },
}

/**
 * "(Components: A, B)" — no mesmo corpo da descrição, sem estilo próprio.
 * O texto cadastrado no produto às vezes já traz a palavra ("Components: …" /
 * "Componentes: …") e às vezes já vem entre parênteses: aí só se garante o
 * parêntese, sem repetir o rótulo. Vazio quando não há componentes.
 */
export function componentsLine(language: QuoteLanguage, components: string | null | undefined) {
  let text = components?.trim() ?? ''
  if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim()
  if (!text) return ''
  const label = LABELS[language].components
  const alreadyLabeled = /^(components?|componentes?)\s*:/i.test(text)
  return `(${alreadyLabeled ? text : `${label}: ${text}`})`
}

export function formatMoney(value: number, currency: string, language: QuoteLanguage) {
  return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], { style: 'currency', currency }).format(value)
}
