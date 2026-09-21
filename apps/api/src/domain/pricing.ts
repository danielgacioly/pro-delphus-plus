/**
 * Regras de preço de orçamento que só o servidor aplica, sem banco e sem HTTP.
 *
 * O que a tela também precisa calcular (moeda por tipo de venda, coluna de
 * preço por moeda e tabela) mora em `packages/shared/src/pricing.ts`.
 */

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
