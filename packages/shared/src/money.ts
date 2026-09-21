/** Contas de dinheiro que a API e as telas precisam fazer do mesmo jeito. */
import type { PrepaymentMethod } from './enums.js'

/**
 * Total do Invoice: subtotal do orçamento mais frete, menos desconto, mais a
 * taxa do PayPal quando é essa a forma de pagamento.
 *
 * O "total do orçamento" nunca inclui a taxa, porque ela é um dado do pedido e
 * não do orçamento — sem este cálculo à parte, trocar para PayPal e salvar
 * parecia não fazer efeito nenhum na tela, já que o único total visível ficava
 * igual. E a taxa só entra quando o pagamento é PayPal, que é a mesma condição
 * com que ela aparece impressa: somar sempre fazia um pedido criado no PayPal
 * e depois trocado para transferência sair com Invoice que não fecha com as
 * próprias linhas.
 */
export function invoiceTotal(input: {
  subtotal: number
  freight: number | null | undefined
  discount: number
  prepaymentBy: PrepaymentMethod
  paypalFee: number | null | undefined
}): number {
  const fee = input.prepaymentBy === 'PAYPAL' ? (input.paypalFee ?? 0) : 0
  return input.subtotal + (input.freight ?? 0) - input.discount + fee
}
