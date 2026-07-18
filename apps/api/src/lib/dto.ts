import type {
  Order,
  Product,
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
    createdAt: user.createdAt.toISOString(),
  }
}

export function toProductDTO(
  product: Product & { media: ProductMedia[]; customizations: ProductCustomization[] },
) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    sector: product.sector,
    kind: product.kind,
    weightKg: product.weightKg?.toString() ?? null,
    priceBRL: product.priceBRL?.toString() ?? null,
    priceUSD: product.priceUSD?.toString() ?? null,
    priceUSDDistributor: product.priceUSDDistributor?.toString() ?? null,
    active: product.active,
    updatedAt: product.updatedAt.toISOString(),
    media: product.media
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ id: m.id, url: m.url, type: m.type, order: m.order, isPrimary: m.isPrimary })),
    customizations: product.customizations.map((c) => ({
      id: c.id,
      name: c.name,
      options: c.options,
    })),
  }
}

export function toQuoteDTO(
  quote: Quote & { items: (QuoteItem & { product: Product })[]; createdBy: Pick<User, 'id' | 'name'> },
) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    language: quote.language,
    priceTier: quote.priceTier,
    clientPrefix: quote.clientPrefix,
    clientName: quote.clientName,
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
      sku: item.sku,
      quantity: item.quantity,
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
    quote: Quote & { items: (QuoteItem & { product: Product })[]; createdBy: Pick<User, 'id' | 'name'> }
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
