import type {
  Client,
  Order,
  PersonalBoardColumn,
  PersonalTask,
  Product,
  ProductBrochure,
  ProductCustomization,
  ProductMedia,
  Quote,
  QuoteItem,
  User,
} from '../../generated/prisma/client.js'
import type { BoxAssignments } from '@prodelphusplus/shared'

export function toUserDTO(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    active: user.active,
    phone: user.phone,
    jobTitle: user.jobTitle,
    signatureUrl: user.signatureUrl,
    catalogLanguage: user.catalogLanguage as 'EN' | 'PT',
    createdAt: user.createdAt.toISOString(),
  }
}

export function toProductDTO(
  product: Product & {
    media: ProductMedia[]
    brochures: ProductBrochure[]
    customizations: ProductCustomization[]
  },
) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    descriptionPt: product.descriptionPt,
    components: product.components,
    componentsPt: product.componentsPt,
    sectors: product.sectors,
    videoLinks: product.videoLinks,
    kind: product.kind,
    weightKg: product.weightKg?.toString() ?? null,
    priceBRL: product.priceBRL?.toString() ?? null,
    priceUSD: product.priceUSD?.toString() ?? null,
    priceUSDDistributor: product.priceUSDDistributor?.toString() ?? null,
    priceEUR: product.priceEUR?.toString() ?? null,
    active: product.active,
    updatedAt: product.updatedAt.toISOString(),
    media: product.media
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ id: m.id, url: m.url, type: m.type, order: m.order, isPrimary: m.isPrimary })),
    brochures: product.brochures
      .sort((a, b) => a.order - b.order)
      .map((b) => ({ id: b.id, url: b.url, name: b.name, order: b.order })),
    customizations: product.customizations.map((c) => ({
      id: c.id,
      name: c.name,
      options: c.options,
    })),
  }
}

export function toQuoteDTO(
  quote: Quote & {
    items: (QuoteItem & { product: Product })[]
    createdBy: Pick<User, 'id' | 'name'>
    client: Pick<Client, 'country'> | null
  },
) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    language: quote.language,
    currency: quote.currency,
    priceTier: quote.priceTier,
    clientPrefix: quote.clientPrefix,
    clientName: quote.clientName,
    clientId: quote.clientId,
    clientCountry: quote.client?.country ?? null,
    notes: quote.notes,
    freight: quote.freight?.toString() ?? null,
    discount: quote.discount.toString(),
    subtotal: quote.subtotal.toString(),
    total: quote.total.toString(),
    pdfUrl: quote.pdfUrl,
    xlsxUrl: quote.xlsxUrl,
    createdAt: quote.createdAt.toISOString(),
    createdBy: { id: quote.createdBy.id, name: quote.createdBy.name },
    items: quote.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      listPrice: item.listPrice?.toString() ?? null,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
      productName: item.product.name,
      description: item.description,
    })),
  }
}

export function toOrderDTO(
  order: Order & {
    createdBy: Pick<User, 'id' | 'name'>
    quote: Quote & {
      items: (QuoteItem & { product: Product })[]
      createdBy: Pick<User, 'id' | 'name'>
      client: Pick<Client, 'country'> | null
    }
  },
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    quoteId: order.quoteId,
    quoteNumber: order.quote.quoteNumber,
    purchaseOrder: order.purchaseOrder,
    orderedByEmail: order.orderedByEmail,
    shipDate: order.shipDate?.toISOString() ?? null,
    invoiceDate: order.invoiceDate.toISOString(),
    billToText: order.billToText,
    shipToText: order.shipToText,
    shipToNote: order.shipToNote,
    numberOfPackages: order.numberOfPackages,
    netWeightKg: order.netWeightKg?.toString() ?? null,
    grossWeightKg: order.grossWeightKg?.toString() ?? null,
    awbNumber: order.awbNumber,
    incoterms: order.incoterms,
    prepaymentBy: order.prepaymentBy,
    paypalFee: order.paypalFee?.toString() ?? null,
    nfNumber: order.nfNumber,
    nfDate: order.nfDate?.toISOString() ?? null,
    nfDocumentUrl: order.nfDocumentUrl,
    awbDocumentUrl: order.awbDocumentUrl,
    exchangeRate: order.exchangeRate?.toString() ?? null,
    itemWeightsKg: (order.itemWeightsKg as (number | null)[] | null) ?? null,
    packageCount: order.packageCount,
    boxAssignments: (order.boxAssignments as BoxAssignments | null) ?? null,
    status: order.status,
    invoicePdfUrl: order.invoicePdfUrl,
    packingListPdfUrl: order.packingListPdfUrl,
    packingListBoxPdfUrl: order.packingListBoxPdfUrl,
    exportDocXlsxUrl: order.exportDocXlsxUrl,
    createdAt: order.createdAt.toISOString(),
    createdBy: { id: order.createdBy.id, name: order.createdBy.name },
    quote: toQuoteDTO(order.quote),
  }
}

export function toPersonalTaskDTO(
  task: PersonalTask & { quote?: Pick<Quote, 'quoteNumber'> | null; order?: Pick<Order, 'orderNumber'> | null },
) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    clientName: task.clientName,
    tags: task.tags,
    dueDate: task.dueDate?.toISOString() ?? null,
    columnId: task.columnId,
    position: task.position,
    quoteId: task.quoteId,
    quoteNumber: task.quote?.quoteNumber ?? null,
    orderId: task.orderId,
    orderNumber: task.order?.orderNumber ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

// `isDone` ainda não está no client tipado (ver nota em tasks.routes.ts) — o
// chamador sempre busca esse valor à parte e junta antes de passar pra cá.
export function toPersonalBoardColumnDTO(column: PersonalBoardColumn & { isDone: boolean }) {
  return {
    id: column.id,
    name: column.name,
    position: column.position,
    isDone: column.isDone,
  }
}
