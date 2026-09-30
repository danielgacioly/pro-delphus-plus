import type { CatalogLanguage, SectorDTO } from '@prodelphusplus/shared'

/**
 * O campo no idioma do catálogo, caindo no outro idioma quando só um foi
 * cadastrado. Antes só caía de PT pra EN: produto com descrição só em
 * português aparecia como "Sem descrição cadastrada" pra quem vê em inglês.
 */
export function localize(en: string | null, pt: string | null | undefined, lang: CatalogLanguage): string | null {
  const english = en?.trim() || null
  const portuguese = pt?.trim() || null
  return lang === 'PT' ? (portuguese ?? english) : (english ?? portuguese)
}

/** Traduz o nome do setor (como está em Product.sectors) pelo `namePt` do cadastro de setores, caindo no nome original. */
export function localizeSector(name: string, sectors: SectorDTO[] | undefined, lang: CatalogLanguage): string {
  if (lang !== 'PT') return name
  const match = sectors?.find((s) => s.name === name)
  return match?.namePt || name
}
