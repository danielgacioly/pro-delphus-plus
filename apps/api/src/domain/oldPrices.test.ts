import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchOldPrice, modelCode, type OldPriceRow } from './oldPrices.js'

function row(partial: Partial<OldPriceRow>): OldPriceRow {
  return { sheet: 'X', sku: '', code: '', usd: null, eur: null, oldUSD: null, oldEUR: null, oldBRL: null, ...partial }
}

function product(partial: { sku?: string; name: string; priceUSD?: number | null; priceEUR?: number | null }) {
  return { id: 'p', sku: partial.sku ?? '', name: partial.name, priceUSD: partial.priceUSD ?? null, priceEUR: partial.priceEUR ?? null }
}

describe('modelCode', () => {
  it('pega a primeira palavra em maiúsculas, com travessão virando hífen', () => {
    assert.equal(modelCode('  etx-0 Base of the ETX A2 LAP'), 'ETX-0')
    assert.equal(modelCode('MMT–1PA Unidade cirúrgica'), 'MMT-1PA')
  })
})

describe('matchOldPrice', () => {
  it('casa pelo código do modelo mesmo sem SKU', () => {
    const rows = [row({ code: 'MMT', oldUSD: 2659.67 }), row({ code: 'MMT-0', oldUSD: 1418.16 })]
    const match = matchOldPrice(product({ name: 'MMT Mastotrainer' }), rows)
    assert.equal(match.status, 'matched')
    assert.equal(match.status !== 'unmatched' && match.row.oldUSD, 2659.67)
  })

  it('não casa produto sem código correspondente na planilha', () => {
    assert.equal(matchOldPrice(product({ name: 'LAZARUS' }), [row({ code: 'MMT', oldUSD: 1 })]).status, 'unmatched')
  })

  it('usa o SKU para desempatar mesmo código', () => {
    const rows = [row({ code: 'ETX', sku: '320', oldUSD: 5786.1 }), row({ code: 'ETX', sku: '999', oldUSD: 1 })]
    const match = matchOldPrice(product({ sku: '320', name: 'ETX A2 LAP' }), rows)
    assert.equal(match.status !== 'unmatched' && match.row.oldUSD, 5786.1)
  })

  it('recusa código igual com SKU e preço diferentes — é outro produto', () => {
    const rows = [row({ code: 'ETX', sku: '320', usd: 3500, oldUSD: 5786.1 })]
    const match = matchOldPrice(product({ sku: '777', name: 'ETX Neuro', priceUSD: 900 }), rows)
    assert.equal(match.status, 'unmatched')
  })

  it('desempata pelo preço atual em dólar quando o mesmo código aparece em várias abas', () => {
    const rows = [
      row({ code: 'BP-2', sku: '527', usd: 532.42, oldUSD: 532.42 }),
      row({ code: 'BP-2', sku: '527', usd: 851, oldUSD: 851.14 }),
      row({ code: 'BP-2', sku: '527', usd: 919.86, oldUSD: 900 }),
    ]
    const match = matchOldPrice(product({ sku: '527', name: 'BP-2 (Pectus Excavatum)', priceUSD: 919.86 }), rows)
    assert.equal(match.status, 'matched')
    assert.equal(match.status !== 'unmatched' && match.row.oldUSD, 900)
  })

  it('valores repetidos em várias abas contam como um só', () => {
    const rows = [row({ code: 'ETXY-0P', oldUSD: 347.12, oldEUR: 308.71 }), row({ code: 'ETXY-0P', oldUSD: 347.12, oldEUR: 308.71 })]
    assert.equal(matchOldPrice(product({ name: 'ETXY-0P' }), rows).status, 'matched')
  })

  it('marca como divergente quando sobram valores diferentes, ficando com o da primeira aba', () => {
    const rows = [row({ code: 'ETXY-0', usd: 1500, oldUSD: 3899.94 }), row({ code: 'ETXY-0', usd: 1500, oldUSD: 3898.71 })]
    const match = matchOldPrice(product({ name: 'ETXY-0', priceUSD: 1500 }), rows)
    assert.equal(match.status, 'divergent')
    assert.equal(match.status !== 'unmatched' && match.row.oldUSD, 3899.94)
    assert.equal(match.status !== 'unmatched' && match.alternatives.length, 1)
  })
})
