export type Role = 'ADMIN' | 'USER'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ClientPrefix = 'NONE' | 'MR' | 'MS'

export type QuoteLanguage = 'PT' | 'EN' | 'ES'

export type MediaType = 'IMAGE' | 'DOCUMENT'

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

export interface PriceTableEntryDTO {
  id: string
  sku: string
  sector: string
  description: string
  priceBRL: string | null
  priceUSD: string | null
  active: boolean
  updatedAt: string
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
  weightKg: string | null
  active: boolean
  media: ProductMediaDTO[]
  customizations: ProductCustomizationDTO[]
}

export interface QuoteItemInput {
  sku: string
  quantity: number
}

export interface QuoteDTO {
  id: string
  quoteNumber: string
  language: QuoteLanguage
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
  items: Array<{
    sku: string
    quantity: number
    unitPrice: string
    lineTotal: string
    productName: string
  }>
}
