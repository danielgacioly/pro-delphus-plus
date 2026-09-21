import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogPriceFor, priceTierLabel, resolvePriceTier, resolveQuoteLocale } from './pricing.js'

const catalog = {
  priceBRL: 15_000,
  priceUSD: 3000,
  priceUSDDistributor: 2100,
  priceEUR: 2500,
}

describe('resolveQuoteLocale', () => {
  it('força português e real em venda nacional, qualquer que seja o pedido', () => {
    assert.deepEqual(resolveQuoteLocale({ exportScope: 'NATIONAL', language: 'EN', currency: 'USD' }), {
      language: 'PT',
      currency: 'BRL',
    })
  })

  it('respeita idioma e moeda na exportação', () => {
    assert.deepEqual(resolveQuoteLocale({ exportScope: 'INTERNATIONAL', language: 'ES', currency: 'EUR' }), {
      language: 'ES',
      currency: 'EUR',
    })
  })

  it('usa dólar quando a exportação não manda moeda', () => {
    assert.equal(resolveQuoteLocale({ exportScope: 'INTERNATIONAL', language: 'EN' }).currency, 'USD')
  })
})

describe('resolvePriceTier', () => {
  it('mantém distribuidor em dólar', () => {
    assert.equal(resolvePriceTier('USD', 'DISTRIBUTOR'), 'DISTRIBUTOR')
  })

  it('cai para preço final em real e euro, que não têm coluna de distribuidor', () => {
    assert.equal(resolvePriceTier('BRL', 'DISTRIBUTOR'), 'FINAL')
    assert.equal(resolvePriceTier('EUR', 'DISTRIBUTOR'), 'FINAL')
  })
})

describe('catalogPriceFor', () => {
  it('escolhe a coluna da moeda', () => {
    assert.equal(catalogPriceFor(catalog, 'BRL', 'FINAL'), 15_000)
    assert.equal(catalogPriceFor(catalog, 'EUR', 'FINAL'), 2500)
    assert.equal(catalogPriceFor(catalog, 'USD', 'FINAL'), 3000)
  })

  it('usa a coluna de distribuidor só quando a tabela é distribuidor', () => {
    assert.equal(catalogPriceFor(catalog, 'USD', 'DISTRIBUTOR'), 2100)
  })
})

describe('priceTierLabel', () => {
  it('nomeia a tabela de distribuidor junto da moeda', () => {
    assert.equal(priceTierLabel('USD', 'DISTRIBUTOR'), 'USD (distribuidor)')
    assert.equal(priceTierLabel('EUR', 'FINAL'), 'EUR')
  })
})
