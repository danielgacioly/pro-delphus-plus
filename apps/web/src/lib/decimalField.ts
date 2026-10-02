/**
 * Regras do campo de valor decimal (preço, peso, câmbio) — ver DecimalInput.
 *
 * O campo era `type="number"`: a setinha e a rodinha do mouse mudavam o valor
 * de 0,01 em 0,01 (ou 0,001 kg no peso) sem a pessoa perceber, e era daí que
 * saíam os centavos e gramas "aleatórios" nos documentos. Agora é texto puro,
 * e o que se digita passa por aqui.
 */

/**
 * Limpa o que foi digitado ou colado: aceita vírgula como separador decimal,
 * descarta letras e sinais, e não deixa passar de `decimals` casas — a casa
 * a mais simplesmente não entra, em vez de virar um arredondamento surpresa.
 */
export function sanitizeDecimal(raw: string, decimals: number): string {
  let text = raw.replace(/\s/g, '')
  // "1.234,56" (colado de planilha em português): ponto é milhar, vírgula é decimal.
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '')
  text = text.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const dot = text.indexOf('.')
  if (dot === -1) return text
  const integer = text.slice(0, dot)
  const fraction = text.slice(dot + 1).replace(/\./g, '').slice(0, decimals)
  if (decimals === 0) return integer
  return `${integer || '0'}.${fraction}`
}

/** Ao sair do campo: tira o ponto solto no fim ("12." → "12"). */
export function finalizeDecimal(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value
}
