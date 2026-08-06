export type QuoteLanguage = 'PT' | 'EN' | 'ES'

export const LOCALE_BY_LANGUAGE: Record<QuoteLanguage, string> = {
  PT: 'pt-BR',
  EN: 'en-US',
  ES: 'es-ES',
}

export const LABELS: Record<QuoteLanguage, {
  quote: string
  to: string
  item: string
  qty: string
  description: string
  photo: string
  unitPrice: string
  specialPrice: string
  total: string
  shipping: string
  discount: string
  toBeDefined: string
  prefix: { NONE: string; MR: string; MS: string }
}> = {
  PT: {
    quote: 'Orçamento',
    to: 'Para',
    item: 'Item',
    qty: 'Qtd.',
    description: 'Descrição',
    photo: 'Foto',
    unitPrice: 'Preço unit.',
    specialPrice: 'Preço especial',
    total: 'Total',
    shipping: 'Frete',
    discount: 'Desconto',
    toBeDefined: 'A definir',
    prefix: { NONE: '', MR: 'Sr.', MS: 'Sra.' },
  },
  EN: {
    quote: 'Quote',
    to: 'To',
    item: 'Item',
    qty: 'Qty.',
    description: 'Description',
    photo: 'Photo',
    unitPrice: 'Unit Price',
    specialPrice: 'Special Price',
    total: 'Total',
    shipping: 'Shipping',
    discount: 'Discount',
    toBeDefined: 'To be defined',
    prefix: { NONE: '', MR: 'Mr.', MS: 'Ms.' },
  },
  ES: {
    quote: 'Presupuesto',
    to: 'Para',
    item: 'Ítem',
    qty: 'Cant.',
    description: 'Descripción',
    photo: 'Foto',
    unitPrice: 'Precio unit.',
    specialPrice: 'Precio especial',
    total: 'Total',
    shipping: 'Envío',
    discount: 'Descuento',
    toBeDefined: 'Por definir',
    prefix: { NONE: '', MR: 'Sr.', MS: 'Sra.' },
  },
}

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

export function defaultQuoteNotes(language: QuoteLanguage, currency: string): string {
  return DEFAULT_NOTE_LINES[language](currency)
    .map((line) => `* ${line}`)
    .join('\n')
}

export function formatMoney(value: number, currency: string, language: QuoteLanguage) {
  return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], { style: 'currency', currency }).format(value)
}
