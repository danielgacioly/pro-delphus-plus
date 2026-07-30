import type { CatalogLanguage, SectorDTO } from '@prodelphusplus/shared'

/** Picks the Portuguese variant of a field when the language is PT and a translation exists, else falls back to the English value. */
export function localize(en: string | null, pt: string | null | undefined, lang: CatalogLanguage): string | null {
  if (lang === 'PT' && pt) return pt
  return en
}

/** Translates a sector name (as stored on Product.sectors) using the Sector catalog's namePt, falling back to the original name. */
export function localizeSector(name: string, sectors: SectorDTO[] | undefined, lang: CatalogLanguage): string {
  if (lang !== 'PT') return name
  const match = sectors?.find((s) => s.name === name)
  return match?.namePt || name
}
