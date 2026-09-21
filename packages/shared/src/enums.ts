/**
 * Os conjuntos fechados de valores que atravessam API, banco e telas. Ficam
 * juntos por serem a parte mais estável do contrato — mudar um deles é mudar
 * o domínio, não a implementação.
 */
export type Role = 'ADMIN' | 'USER'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ClientPrefix = 'NONE' | 'MR' | 'MS'

export type QuoteLanguage = 'PT' | 'EN' | 'ES'

/** Nacional = BRL, sempre em português, sem câmbio/packing list/documento de exportação. */
export type ExportScope = 'NATIONAL' | 'INTERNATIONAL'

export type PriceTier = 'FINAL' | 'DISTRIBUTOR'

export type Currency = 'BRL' | 'USD' | 'EUR'

export type MediaType = 'IMAGE' | 'DOCUMENT'

export type ProductKind = 'COMPLETE_MODEL' | 'COMPONENT'

export type CatalogLanguage = 'EN' | 'PT'

export type ClientKind = 'INDIVIDUAL' | 'INSTITUTION' | 'DISTRIBUTOR'
export type PrepaymentMethod = 'PAYPAL' | 'WIRE_TRANSFER' | 'PIX'
export type OrderStatus = 'PENDING' | 'COMPLETED'
/**
 * Uma linha dentro de uma caixa: rótulo e quantidade, livremente editáveis.
 *
 * Propositalmente solta da identidade do item do orçamento — é o que permite
 * descrever a venda de um modelo completo como os componentes físicos dele
 * quando a remessa precisa dividi-los entre caixas.
 */
export interface BoxAssignmentEntry {
  label: string
  quantity: number
}
export type BoxAssignments = BoxAssignmentEntry[][]
