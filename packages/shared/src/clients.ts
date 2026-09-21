/** Regras de tratamento do cliente (Sr./Mr.) que valem para tela e documento. */
import type { ClientPrefix, QuoteLanguage } from './enums.js'

const BRAZIL_COUNTRY_ALIASES = new Set(['brasil', 'brazil', 'br'])

/** Reconhece os valores de `Client.country` (texto livre) que significam Brasil, ignorando caixa e espaços. */
export function isBrazilianCountry(country: string | null | undefined): boolean {
  if (!country) return false
  return BRAZIL_COUNTRY_ALIASES.has(country.trim().toLowerCase())
}

/**
 * Sr./Sra. e Mr./Ms. são tratamentos ligados à nacionalidade do CLIENTE, não
 * ao idioma em que o documento saiu: cliente brasileiro num orçamento em
 * inglês continua "Sr."/"Sra.", e cliente estrangeiro num orçamento em
 * português continua "Mr."/"Ms.".
 *
 * Esta é a única fonte dessa regra — toda tela e todo documento gerado
 * resolvem o tratamento por aqui, em vez de manter a própria cópia indexada
 * por idioma.
 *
 * `country` é o país (texto livre) do cliente cadastrado. Orçamento com nome
 * digitado à mão, sem cliente vinculado, não tem sinal nenhum de
 * nacionalidade — só nesse caso o idioma do orçamento serve de aproximação.
 */
export function clientPrefixLabel(
  prefix: ClientPrefix,
  country: string | null | undefined,
  language: QuoteLanguage,
): string {
  if (prefix === 'NONE') return ''
  const isBrazilian = country ? isBrazilianCountry(country) : language !== 'EN'
  if (prefix === 'MR') return isBrazilian ? 'Sr.' : 'Mr.'
  return isBrazilian ? 'Sra.' : 'Ms.'
}

