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
  /** Preço negociado. Em branco, vale o preço de catálogo da moeda e tabela do orçamento. */
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
    /** Componentes impressos junto da descrição; null = nenhum. */
    components: string | null
    /** Tipo do produto — só "modelo completo" tem campo de componentes. */
    productKind: ProductKind
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
  /** Só pra pedido nacional — link opcional de pagamento por cartão de crédito. */
  creditCardPaymentLink?: string
  prepaymentBy: PrepaymentMethod
  paypalFee?: number
  nfNumber?: string
  nfDate?: string
  exchangeRate?: number
  /** Peso em kg por item, alinhado por índice com os itens do orçamento de origem — alimenta o Documento de Exportação. */
  itemWeightsKg?: (number | null)[]
  /** Quantidade de caixas físicas — define quantas páginas o Packing List Box tem. */
  packageCount?: number
  boxAssignments?: BoxAssignments
}

export interface OrderDTO {
  id: string
  orderNumber: number
  /** "ID da pasta do cliente" — só pedido internacional, contador próprio. */
  clientFolderId: number | null
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
  /** Só pedido nacional — link opcional de pagamento por cartão de crédito. */
  creditCardPaymentLink: string | null
  prepaymentBy: PrepaymentMethod
  paypalFee: string | null
  nfNumber: string | null
  nfDate: string | null
  nfDocumentUrl: string | null
  awbDocumentUrl: string | null
  boletoDocumentUrl: string | null
  gnreDocumentUrl: string | null
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


/** Tópico de uma pergunta da Biblioteca — um produto do catálogo ou um cliente. */
export interface LibraryTopicDTO {
  type: 'product' | 'client'
  id: string
  name: string
  /** SKU do produto, ou instituição do cliente — o que diferencia nomes parecidos. */
  detail: string | null
}

export interface LibraryEntryDTO {
  id: string
  question: string
  answer: string
  topics: LibraryTopicDTO[]
  createdAt: string
  updatedAt: string
  createdByName: string | null
  updatedByName: string | null
  /**
   * Só vem numa busca: quão perto do que foi pesquisado — `strong` é quase a
   * mesma pergunta, `related` é do mesmo assunto.
   */
  match?: 'strong' | 'related'
}

export interface LibraryEntryInput {
  question: string
  answer: string
  productIds: string[]
  clientIds: string[]
}
