/**
 * Que preço do catálogo vale para cada combinação de tipo de venda, moeda e
 * tabela.
 *
 * Mora aqui porque as duas pontas precisam da mesma resposta: o servidor para
 * fechar o orçamento e a tela para mostrar o preço de catálogo enquanto a
 * pessoa monta o item. Escrita duas vezes, uma delas sai do lugar.
 */
import type { Currency, ExportScope, PriceTier, QuoteLanguage } from './enums.js'

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
 * Se o item foi negociado para baixo, que é o que o documento mostra como
 * preço especial (o de tabela riscado ao lado do cobrado).
 *
 * Preço customizado MAIOR que o de tabela não é "especial": é só o preço
 * daquele item, sem riscado e sem coluna extra. A coluna de preço especial só
 * existe no documento quando pelo menos um item está nessa condição — assim
 * orçamento sem negociação sai idêntico ao de antes, sem coluna vazia.
 */
export function hasSpecialPrice(item: { listPrice: number | null; unitPrice: number }): boolean {
  return item.listPrice !== null && item.unitPrice < item.listPrice
}
