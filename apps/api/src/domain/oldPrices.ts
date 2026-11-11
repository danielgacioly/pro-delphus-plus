/**
 * Casamento dos preços antigos da planilha 2025 (OLD USD, OLD EURO, REAL
 * ANTIGO) com os produtos do catálogo — usado pelo script
 * `prisma/seed-old-prices.ts`, sem banco nem planilha aqui.
 *
 * A planilha não tem uma chave limpa: SKU falta em vários modelos completos e
 * o mesmo produto aparece em mais de uma aba (a ETXY-0 está em Histeroscopia,
 * Proctologia e Endourologia), às vezes com centavos de diferença. O nome do
 * produto, por outro lado, sempre começa pelo código do modelo (ETX-0,
 * MMT-1PA…) tanto no catálogo, em inglês, quanto na planilha, em português.
 * Então o código é a chave, o SKU desempata, e o preço atual em dólar/euro
 * desempata o que sobrar.
 */

export interface OldPriceRow {
  sheet: string
  sku: string
  code: string
  usd: number | null
  eur: number | null
  oldUSD: number | null
  oldEUR: number | null
  oldBRL: number | null
}

export interface CatalogProductForMatch {
  id: string
  sku: string
  name: string
  priceUSD: number | null
  priceEUR: number | null
}

export type OldPriceMatch =
  | { status: 'matched' | 'divergent'; row: OldPriceRow; alternatives: OldPriceRow[] }
  | { status: 'unmatched' }

/** Primeira palavra do nome, em maiúsculas e com o travessão trocado por hífen. */
export function modelCode(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first.toUpperCase().replace(/[–—]/g, '-')
}

const samePrice = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 0.01

const oldKey = (r: OldPriceRow) => `${r.oldUSD}|${r.oldEUR}|${r.oldBRL}`

function distinctOld(rows: OldPriceRow[]): OldPriceRow[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = oldKey(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Fica com os que passam no filtro — a não ser que nenhum passe. */
function narrow(rows: OldPriceRow[], keep: (r: OldPriceRow) => boolean): OldPriceRow[] {
  const kept = rows.filter(keep)
  return kept.length > 0 ? kept : rows
}

export function matchOldPrice(product: CatalogProductForMatch, rows: OldPriceRow[]): OldPriceMatch {
  const code = modelCode(product.name)
  if (!code) return { status: 'unmatched' }
  let candidates = rows.filter((r) => modelCode(r.code) === code)
  if (candidates.length === 0) return { status: 'unmatched' }

  const sku = product.sku.trim()
  const skuMatches = sku ? candidates.filter((r) => r.sku === sku) : []
  if (skuMatches.length > 0) {
    candidates = skuMatches
  } else if (sku) {
    // Código igual mas SKU diferente: só aceita se o preço atual bater, senão
    // é outro produto que por acaso começa com a mesma palavra ("ETX …").
    candidates = candidates.filter((r) => !r.sku || samePrice(r.usd, product.priceUSD))
    if (candidates.length === 0) return { status: 'unmatched' }
  }

  candidates = narrow(candidates, (r) => samePrice(r.usd, product.priceUSD))
  candidates = narrow(candidates, (r) => samePrice(r.eur, product.priceEUR))

  const distinct = distinctOld(candidates)
  // Sobrou mais de um valor antigo para o mesmo produto: fica o da primeira
  // aba da planilha, e o relatório avisa para alguém conferir.
  return { status: distinct.length === 1 ? 'matched' : 'divergent', row: distinct[0], alternatives: distinct.slice(1) }
}
