import type {
  Product,
  ProductCustomization,
  ProductMedia,
  Quote,
  QuoteItem,
  User,
} from '../../generated/prisma/client.js'

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

export function toQuoteDTO(quote: Quote & { items: (QuoteItem & { product: Product }) [] }) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    language: quote.language,
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
