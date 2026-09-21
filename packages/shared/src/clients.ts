/** Regras de tratamento do cliente (Sr./Mr.) que valem para tela e documento. */
import type { ClientPrefix, QuoteLanguage } from './enums.js'

const BRAZIL_COUNTRY_ALIASES = new Set(['brasil', 'brazil', 'br'])

/** Matches free-text `Client.country` values that mean Brazil, case/whitespace-insensitive. */
export function isBrazilianCountry(country: string | null | undefined): boolean {
  if (!country) return false
  return BRAZIL_COUNTRY_ALIASES.has(country.trim().toLowerCase())
}

/**
 * Sr./Sra. and Mr./Ms. are honorifics tied to the CLIENT's nationality, not to
 * whatever language the quote document happens to be written in — a Brazilian
 * client addressed in an English-language quote is still "Sr."/"Sra.", and a
 * foreign client addressed in a Portuguese-language quote is still "Mr."/"Ms.".
 * This is the single source of truth for that rule — every screen and
 * generated document resolves the label through here instead of keeping its
 * own language-keyed copy.
 *
 * `country` is the linked Client record's free-text country. A quote with
 * just a typed-in client name (no linked record) has no nationality signal at
 * all, so the quote's language is the closest fallback in that case only.
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

