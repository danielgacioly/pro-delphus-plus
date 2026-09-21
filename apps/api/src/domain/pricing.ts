/**
 * Regras de preço de orçamento, sem banco e sem HTTP.
 *
 * Moram aqui porque são a parte do orçamento que precisa estar certa
 * independentemente de onde a chamada veio (tela, NEO ou script), e porque
 * separadas assim dá para testá-las sem subir Postgres.
 */
import type { Currency, ExportScope, PriceTier, QuoteLanguage } from '@prodelphusplus/shared'


/** As quatro colunas de preço do catálogo. Qualquer uma pode estar vazia. */
export interface CatalogPrices {
  priceBRL: unknown
  priceUSD: unknown
  priceUSDDistributor: unknown
  priceEUR: unknown
}

/**
 * Venda nacional é sempre em português e em real — quem decide não é o idioma
 * escolhido, é o tipo de venda. Na exportação, dólar é o padrão histórico de
 * quem não manda moeda.
 */
export function resolveQuoteLocale(input: {
  exportScope: ExportScope
  language: QuoteLanguage
  currency?: Currency
}): { language: QuoteLanguage; currency: Currency } {
  if (input.exportScope === 'NATIONAL') return { language: 'PT', currency: 'BRL' }
  return { language: input.language, currency: input.currency ?? 'USD' }
}

/**
 * Preço de distribuidor só existe na coluna de dólar do catálogo, então
 * orçamento em real ou euro cai no preço final mesmo que o formulário peça
 * distribuidor.
 */
export function resolvePriceTier(currency: Currency, requested: PriceTier): PriceTier {
  return currency === 'USD' ? requested : 'FINAL'
}

/** A coluna do catálogo que vale para esta combinação de moeda e tabela. */
export function catalogPriceFor(product: CatalogPrices, currency: Currency, tier: PriceTier): unknown {
  if (currency === 'BRL') return product.priceBRL
  if (currency === 'EUR') return product.priceEUR
  return tier === 'DISTRIBUTOR' ? product.priceUSDDistributor : product.priceUSD
}

/** Como a moeda e a tabela aparecem juntas numa mensagem de erro. */
export function priceTierLabel(currency: Currency, tier: PriceTier): string {
  return tier === 'DISTRIBUTOR' ? `${currency} (distribuidor)` : currency
}

/**
 * Um item só pode ser orçado se o catálogo tiver preço na coluna escolhida —
 * ou se quem está orçando digitou um preço à mão, que é a saída para produto
 * sem preço de tabela naquela moeda.
 */
export function hasUsablePrice(catalogPrice: unknown, typedUnitPrice: number | undefined): boolean {
  return Boolean(catalogPrice) || typedUnitPrice !== undefined
}

/**
 * Preço de tabela e preço cobrado andam juntos no item. Guardar os dois é o
 * que permite o documento mostrar a coluna de preço especial quando eles
 * divergem, em vez de só sobrescrever o valor e perder a referência.
 */
export function quoteLineAmounts(input: {
  catalogPrice: unknown
  typedUnitPrice: number | undefined
  quantity: number
}): { listPrice: number | null; unitPrice: number; lineTotal: number } {
  const listPrice =
    input.catalogPrice === null || input.catalogPrice === undefined ? null : Number(input.catalogPrice)
  const unitPrice = input.typedUnitPrice ?? (listPrice as number)
  return { listPrice, unitPrice, lineTotal: unitPrice * input.quantity }
}

/**
 * Teto do `Decimal(12,2)` das colunas de dinheiro no Postgres. Acima disso o
 * INSERT falha lá embaixo com erro de overflow, que chegava ao usuário como
 * "500 Erro interno" em vez de dizer o que estava errado.
 */
export const MAX_QUOTE_AMOUNT = 9_999_999_999.99

/** Subtotal (soma dos itens), frete e desconto fechando o total do orçamento. */
export function quoteTotals(input: {
  lineTotals: number[]
  freight: number | null | undefined
  discount: number
}): { subtotal: number; total: number } {
  const subtotal = input.lineTotals.reduce((sum, value) => sum + value, 0)
  return { subtotal, total: subtotal + (input.freight ?? 0) - input.discount }
}

/**
 * Desconto maior que o que há para descontar deixava o orçamento com total
 * negativo, sem aviso nenhum — e o número seguia para o Invoice e para as
 * métricas (receita cotada ficava negativa). É quase sempre um dígito a mais
 * digitado por engano.
 */
export function isDiscountTooLarge(discount: number, subtotal: number, freight: number | null | undefined): boolean {
  return discount > subtotal + (freight ?? 0)
}

/** Se algum dos valores estoura o `Decimal(12,2)` do banco. */
export function exceedsAmountLimit(subtotal: number, total: number): boolean {
  return subtotal > MAX_QUOTE_AMOUNT || total > MAX_QUOTE_AMOUNT
}
