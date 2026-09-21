/**
 * Regras sobre a documentação de um pedido: qual forma de pagamento existe em
 * cada tipo de venda e o que ainda falta anexar. Sem banco e sem HTTP, pelos
 * mesmos motivos de `domain/pricing.ts`.
 */
import type { ExportScope, PrepaymentMethod } from '@prodelphusplus/shared'

/**
 * Pix só existe em venda nacional; PayPal (com taxa) só em exportação. A tela
 * já mostra apenas a opção válida, mas a regra também precisa valer na API: um
 * pedido duplicado ou editado por outro caminho não pode acabar com uma forma
 * de pagamento que não existe naquele tipo de venda.
 *
 * @returns a mensagem do problema, ou `null` quando a combinação é válida.
 */
export function prepaymentRejection(prepaymentBy: PrepaymentMethod, isNational: boolean): string | null {
  if (isNational && prepaymentBy === 'PAYPAL') {
    return 'PayPal não se aplica a pedido nacional. Use Pix ou transferência bancária.'
  }
  if (!isNational && prepaymentBy === 'PIX') {
    return 'Pix não se aplica a pedido internacional. Use PayPal ou transferência bancária.'
  }
  return null
}

/**
 * O que falta documentar num pedido, pelas regras do passo 5 do processo
 * comercial (ver `NEO_SALES_PROCESS` em `lib/neoKnowledge.ts`): internacional
 * pede AWB + Nota Fiscal; nacional só Nota Fiscal (boleto/Pix é a forma de
 * pagamento escolhida, não um documento a conferir aqui). Pedido já concluído
 * não tem pendência — a pessoa já decidiu que está tudo certo.
 *
 * Compartilhada com o NEO (`verificar_pendencias` em `lib/neoTools.ts`): as
 * duas pontas usam exatamente esta função, a regra só existe uma vez.
 */
export function missingPostOrderDocs(
  order: { status: 'PENDING' | 'COMPLETED'; awbNumber: string | null; nfNumber: string | null },
  exportScope: ExportScope,
): string[] {
  if (order.status === 'COMPLETED') return []
  const missing: string[] = []
  if (exportScope === 'INTERNATIONAL' && !order.awbNumber) missing.push('AWB')
  if (!order.nfNumber) missing.push('Nota Fiscal')
  return missing
}
