export type Role = 'ADMIN' | 'USER'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ClientPrefix = 'NONE' | 'MR' | 'MS'

export type QuoteLanguage = 'PT' | 'EN' | 'ES'

export type PriceTier = 'FINAL' | 'DISTRIBUTOR'

export type MediaType = 'IMAGE' | 'DOCUMENT'

export type ProductKind = 'COMPLETE_MODEL' | 'COMPONENT'

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

export interface ProductDTO {
  id: string
  sku: string
  name: string
  description: string | null
  sector: string
  kind: ProductKind
  weightKg: string | null
  priceBRL: string | null
  priceUSD: string | null
  priceUSDDistributor: string | null
  active: boolean
  updatedAt: string
  media: ProductMediaDTO[]
  customizations: ProductCustomizationDTO[]
}

export interface SectorDTO {
  id: string
  name: string
  productCount: number
}

export interface QuoteItemInput {
  productId: string
  quantity: number
  description?: string
}

export interface QuoteDTO {
  id: string
  quoteNumber: string
  language: QuoteLanguage
  priceTier: PriceTier
  clientPrefix: ClientPrefix
  clientName: string
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
    sku: string
    quantity: number
    unitPrice: string
    lineTotal: string
    productName: string
    description: string
  }>
}

export type PrepaymentMethod = 'PAYPAL' | 'WIRE_TRANSFER'

export interface CreateOrderInput {
  quoteId: string
  purchaseOrder?: string
  orderedByEmail: string
  shipDate?: string
  invoiceDate?: string
  billToText: string
  shipToText: string
  shipToNote?: string
  numberOfPackages?: string
  netWeightKg?: number
  grossWeightKg?: number
  awbNumber?: string
  incoterms?: string
  prepaymentBy: PrepaymentMethod
  paypalFee?: number
  nfNumber?: string
  nfDate?: string
  exchangeRate?: number
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
  invoicePdfUrl: string | null
  packingListPdfUrl: string | null
  packingListBoxPdfUrl: string | null
  exportDocXlsxUrl: string | null
  createdAt: string
  createdBy: { id: string; name: string }
  quote: QuoteDTO
}

export * from './sectors.js'
