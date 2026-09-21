import type { CatalogLanguage, SectorDTO } from '@prodelphusplus/shared'

/** Versão em português do campo quando o idioma é PT e existe tradução; senão, o valor em inglês. */
export function localize(en: string | null, pt: string | null | undefined, lang: CatalogLanguage): string | null {
  if (lang === 'PT' && pt) return pt
  return en
}

/** Traduz o nome do setor (como está em Product.sectors) pelo `namePt` do cadastro de setores, caindo no nome original. */
export function localizeSector(name: string, sectors: SectorDTO[] | undefined, lang: CatalogLanguage): string {
  if (lang !== 'PT') return name
  const match = sectors?.find((s) => s.name === name)
  return match?.namePt || name
}
