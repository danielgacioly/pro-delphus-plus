/**
 * O contrato de dados entre API e front: o que cada endpoint devolve (DTO) e o
 * que cada um aceita (Input). Mudar algo aqui é mudar a API.
 */
import type {
  AccountStatus,
  BoxAssignments,
  CatalogLanguage,
  ClientKind,
  ClientPrefix,
  Currency,
  ExportScope,
  MediaType,
  OrderStatus,
  PrepaymentMethod,
  PriceTier,
  ProductKind,
  QuoteLanguage,
  Role,
} from './enums.js'

export interface UserDTO {
  id: string
  name: string
  email: string
  role: Role
  status: AccountStatus
  active: boolean
  /** Telefone fixo. */
  phone: string | null
  whatsapp: string | null
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
  /** Marcação manual de acompanhamento comercial — independente de `active`. */
  inService: boolean
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
  exportScope: ExportScope
  priceTier: PriceTier
  clientPrefix: ClientPrefix
  clientName: string
  clientId: string | null
  /** País do cliente vinculado (Client.country) — null quando o orçamento não tem cliente cadastrado. Usado para escolher Sr./Sra. vs Mr./Ms. */
  clientCountry: string | null
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
    /** Nome impresso no documento: o customizado, se houver, senão o do catálogo. */
    productName: string
    /** Nome customizado neste orçamento; null = segue o catálogo. */
    titleOverride: string | null
    /** Nome atual do produto no catálogo, para servir de placeholder. */
    catalogName: string
    description: string
  }>
}

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
  /** Só pra pedido nacional — texto livre tipo "PAC", "SEDEX", "Transportadora XPTO". */
  shippingMethod?: string
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
  shippingMethod: string | null
  prepaymentBy: PrepaymentMethod
  paypalFee: string | null
  nfNumber: string | null
  nfDate: string | null
  nfDocumentUrl: string | null
  awbDocumentUrl: string | null
  boletoDocumentUrl: string | null
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
  /** O orçamento vinculado foi editado depois da última geração dos documentos deste pedido. */
  documentsStale: boolean
}

export interface PersonalBoardColumnDTO {
  id: string
  name: string
  position: number
  /** Tarefas neste quadro contam como concluídas — suprime o aviso de atraso. */
  isDone: boolean
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

