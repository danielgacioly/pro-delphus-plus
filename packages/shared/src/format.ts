/** Formatação de números que precisa sair igual na tela e no documento. */
/** Número (ou decimal em string) com separador de milhar e duas casas: 40902.77 vira "40,902.77". */
export function formatAmount(value: number | string): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

/** Número do pedido com quatro dígitos para exibição: 0 vira "0000", 23 vira "0023", 12345 continua "12345". */
export function formatOrderNumber(orderNumber: number): string {
  return String(orderNumber).padStart(4, '0')
}

