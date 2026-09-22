import type { ExportScope, QuoteLanguage } from './enums.js'

// Compartilhado entre API (fallback quando o orçamento salva sem comentário)
// e front (pré-preenche o campo de Comentários, editável, em vez de vazio) —
// as duas pontas têm que mostrar exatamente o mesmo texto padrão.
const DEFAULT_NOTE_LINES: Record<QuoteLanguage, (currency: string) => string[]> = {
  PT: (currency) => [
    `Preços em ${currency}`,
    'Prazo de entrega estimado: 2-3 semanas ou menos',
    'Forma de pagamento: pagamento antecipado via transferência bancária ou PayPal (com taxas adicionais)',
    'Orçamento válido por 10 dias',
    'Método de envio: DHL Express',
    'Todos os impostos e taxas de importação são de responsabilidade do cliente',
    'Também oferecemos muitos outros modelos além dos listados. Fique à vontade para nos consultar sobre necessidades específicas',
    'Estamos abertos a personalizar modelos existentes e desenvolver novas soluções de acordo com sua necessidade',
  ],
  EN: (currency) => [
    `Prices listed in ${currency}`,
    'Estimated lead time: 2-3 weeks or less',
    'Payment terms: prepayment by wire transfer or PayPal (with additional fees)',
    'Estimate valid for 10 days',
    'Shipping method: DHL Express',
    "All import taxes and duties are the customer's responsibility",
    'We also offer many other models beyond the ones listed. Feel free to ask us about any specific needs',
    'We are open to customizing existing models and developing new solutions according to your requirements',
  ],
  ES: (currency) => [
    `Precios en ${currency}`,
    'Plazo de entrega estimado: 2-3 semanas o menos',
    'Condiciones de pago: pago anticipado por transferencia bancaria o PayPal (con cargos adicionales)',
    'Presupuesto válido por 10 días',
    'Método de envío: DHL Express',
    'Todos los impuestos y aranceles de importación son responsabilidad del cliente',
    'También ofrecemos muchos otros modelos además de los listados. No dude en consultarnos sobre necesidades específicas',
    'Estamos abiertos a personalizar modelos existentes y desarrollar nuevas soluciones según sus necesidades',
  ],
}

// Nacional é sempre em português, e não tem os itens de exportação (câmbio,
// packing list em inglês, documento de exportação) — em vez disso, o que
// importa numa venda doméstica: ICMS, forma de pagamento local (pix/boleto/
// cartão) e o código NCM (o mesmo usado no Packing List Box — ver
// NCM_HS_CODE em orderPdf.ts). Texto exato pedido pelo Daniel.
const NATIONAL_NOTE_LINES = () => [
  'Dia da Postagem (verificar dependendo da transportadora)',
  'IMPOSTOS: ICMS 12% incluso no valor do produto',
  'PRAZO DE PRODUÇÃO: 2-3 semanas',
  'PRAZO DE PGTO: Pagamento antecipado via pix, boleto ou cartão',
  'CÓDIGO NCM: 90230000',
  'VALIDADE DA COTAÇÃO: 30 dias',
  'Estamos abertos a personalizar modelos existentes e desenvolver novas soluções de acordo com sua necessidade',
]

export function defaultQuoteNotes(language: QuoteLanguage, currency: string, exportScope: ExportScope): string {
  const lines = exportScope === 'NATIONAL' ? NATIONAL_NOTE_LINES() : DEFAULT_NOTE_LINES[language](currency)
  return lines.map((line) => `* ${line}`).join('\n')
}
