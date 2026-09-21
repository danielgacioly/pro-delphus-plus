/** Formatação de números que precisa sair igual na tela e no documento. */
/** Formats a plain number/decimal-string with thousands separators, e.g. 40902.77 -> "40,902.77". */
export function formatAmount(value: number | string): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

/** Pads an order number to 4 digits for display, e.g. 0 -> "0000", 23 -> "0023", 12345 -> "12345". */
export function formatOrderNumber(orderNumber: number): string {
  return String(orderNumber).padStart(4, '0')
}

