export type Role = 'ADMIN' | 'USER'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ClientPrefix = 'NONE' | 'MR' | 'MS'

export type QuoteLanguage = 'PT' | 'EN' | 'ES'

export type PriceTier = 'FINAL' | 'DISTRIBUTOR'

export type Currency = 'BRL' | 'USD' | 'EUR'

export type MediaType = 'IMAGE' | 'DOCUMENT'

export type ProductKind = 'COMPLETE_MODEL' | 'COMPONENT'

export type CatalogLanguage = 'EN' | 'PT'

export interface UserDTO {
  id: string
  name: string
  email: string
  role: Role
  status: AccountStatus
  active: boolean
  phone: string | null
  jobTitle: string | null
  signatureUrl: string | null
  catalogLanguage: CatalogLanguage
  createdAt: string
}

export interface ProductMediaDTO {
  id: string
  url: string
  type: MediaType
  order: number
  isPrimary: boolean
}

export interface ProductCustomizationDTO {
  id: string
  name: string
  options: unknown
}

export interface ProductBrochureDTO {
  id: string
  url: string
  name: string
  order: number
}

export interface ProductDTO {
  id: string
  sku: string
  name: string
  description: string | null
  descriptionPt: string | null
  components: string | null
  componentsPt: string | null
  sectors: string[]
  videoLinks: string[]
  kind: ProductKind
  weightKg: string | null
  priceBRL: string | null
  priceUSD: string | null
  priceUSDDistributor: string | null
  priceEUR: string | null
  active: boolean
  updatedAt: string
  media: ProductMediaDTO[]
  brochures: ProductBrochureDTO[]
  customizations: ProductCustomizationDTO[]
}

export interface SectorDTO {
  id: string
  name: string
  namePt: string | null
  productCount: number
}

export interface QuoteItemInput {
  productId: string
  quantity: number
  description?: string
  /** Manual price override — falls back to the catalog price for the quote's tier/currency when omitted. */
  unitPrice?: number
}

export type ClientKind = 'INDIVIDUAL' | 'INSTITUTION' | 'DISTRIBUTOR'

export interface ClientDTO {
  id: string
  kind: ClientKind
  prefix: ClientPrefix
  name: string
  institution: string | null
  email: string | null
  phone: string | null
  taxId: string | null
  website: string | null
  country: string | null
  state: string | null
  city: string | null
  billToText: string | null
  shipToText: string | null
  sectors: string[]
  notes: string | null
  active: boolean
  createdAt: string
  /** Agregados calculados no servidor — evitam N+1 na listagem. */
  stats: {
    quoteCount: number
    orderCount: number
    totalQuoted: string
    lastQuoteAt: string | null
  }
}

export interface QuoteDTO {
  id: string
  quoteNumber: string
  language: QuoteLanguage
  currency: Currency
  priceTier: PriceTier
  clientPrefix: ClientPrefix
  clientName: string
  clientId: string | null
  notes: string | null
  freight: string | null
  discount: string
  subtotal: string
  total: string
  pdfUrl: string | null
  xlsxUrl: string | null
  createdAt: string
  createdBy: { id: string; name: string }
  items: Array<{
    productId: string
    sku: string
    quantity: number
    /** Preço de catálogo congelado na emissão; null em itens antigos ou sem preço. */
    listPrice: string | null
    /** Preço cobrado. Diferente de `listPrice` = preço especial negociado. */
    unitPrice: string
    lineTotal: string
    productName: string
    description: string
  }>
}

export type PrepaymentMethod = 'PAYPAL' | 'WIRE_TRANSFER'
export type OrderStatus = 'PENDING' | 'COMPLETED'

/**
 * One line inside one box/carton — just a label and a quantity, freely
 * editable. Decoupled from quote-item identity so a complete model's sale
 * can be re-described as its individual physical components when a shipment
 * needs to split those components across boxes.
 */
export interface BoxAssignmentEntry {
  label: string
  quantity: number
}
export type BoxAssignments = BoxAssignmentEntry[][]

export interface CreateOrderInput {
  quoteId: string
  purchaseOrder?: string
  orderedByEmail: string
  shipDate?: string
  invoiceDate?: string
  billToText: string
  shipToText: string
  shipToNote?: string
  netWeightKg?: number
  grossWeightKg?: number
  awbNumber?: string
  incoterms?: string
  prepaymentBy: PrepaymentMethod
  paypalFee?: number
  nfNumber?: string
  nfDate?: string
  exchangeRate?: number
  /** Per-item weight in kg, aligned by index with the source quote's items — feeds the export document. */
  itemWeightsKg?: (number | null)[]
  /** Number of physical boxes/cartons — drives how many pages the Packing List Box gets. */
  packageCount?: number
  boxAssignments?: BoxAssignments
}

export interface OrderDTO {
  id: string
  orderNumber: number
  quoteId: string
  quoteNumber: string
  purchaseOrder: string | null
  orderedByEmail: string
  shipDate: string | null
  invoiceDate: string
  billToText: string
  shipToText: string
  shipToNote: string | null
  numberOfPackages: string | null
  netWeightKg: string | null
  grossWeightKg: string | null
  awbNumber: string | null
  incoterms: string | null
  prepaymentBy: PrepaymentMethod
  paypalFee: string | null
  nfNumber: string | null
  nfDate: string | null
  nfDocumentUrl: string | null
  awbDocumentUrl: string | null
  exchangeRate: string | null
  itemWeightsKg: (number | null)[] | null
  packageCount: number
  boxAssignments: BoxAssignments | null
  status: OrderStatus
  invoicePdfUrl: string | null
  packingListPdfUrl: string | null
  packingListBoxPdfUrl: string | null
  exportDocXlsxUrl: string | null
  createdAt: string
  createdBy: { id: string; name: string }
  quote: QuoteDTO
}

export interface PersonalBoardColumnDTO {
  id: string
  name: string
  position: number
}

export interface PersonalTaskDTO {
  id: string
  title: string
  notes: string | null
  clientName: string | null
  tags: string[]
  dueDate: string | null
  columnId: string
  position: number
  quoteId: string | null
  quoteNumber: string | null
  orderId: string | null
  orderNumber: number | null
  createdAt: string
  updatedAt: string
}

export interface CreatePersonalTaskInput {
  title: string
  notes?: string
  clientName?: string
  tags?: string[]
  dueDate?: string
  columnId?: string
  quoteId?: string
  orderId?: string
}

/** Formats a plain number/decimal-string with thousands separators, e.g. 40902.77 -> "40,902.77". */
export function formatAmount(value: number | string): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

export * from './sectors.js'
