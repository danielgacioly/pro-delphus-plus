import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  catalogPriceFor,
  exceedsAmountLimit,
  hasUsablePrice,
  isDiscountTooLarge,
  MAX_QUOTE_AMOUNT,
  priceTierLabel,
  quoteLineAmounts,
  quoteTotals,
  resolvePriceTier,
  resolveQuoteLocale,
} from './pricing.js'

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

describe('hasUsablePrice', () => {
  it('aceita item com preço de catálogo', () => {
    assert.equal(hasUsablePrice(3000, undefined), true)
  })

  it('aceita item sem preço de catálogo quando o preço foi digitado', () => {
    assert.equal(hasUsablePrice(null, 1234), true)
  })

  it('recusa item sem preço nenhum', () => {
    assert.equal(hasUsablePrice(null, undefined), false)
    assert.equal(hasUsablePrice(undefined, undefined), false)
  })
})

describe('quoteLineAmounts', () => {
  it('cobra o preço de tabela quando nada foi digitado', () => {
    assert.deepEqual(quoteLineAmounts({ catalogPrice: 3000, typedUnitPrice: undefined, quantity: 2 }), {
      listPrice: 3000,
      unitPrice: 3000,
      lineTotal: 6000,
    })
  })

  it('guarda o preço de tabela ao lado do negociado quando divergem', () => {
    assert.deepEqual(quoteLineAmounts({ catalogPrice: 3000, typedUnitPrice: 2500, quantity: 1 }), {
      listPrice: 3000,
      unitPrice: 2500,
      lineTotal: 2500,
    })
  })

  it('deixa o preço de tabela nulo em item sem preço de catálogo', () => {
    assert.deepEqual(quoteLineAmounts({ catalogPrice: null, typedUnitPrice: 800, quantity: 3 }), {
      listPrice: null,
      unitPrice: 800,
      lineTotal: 2400,
    })
  })
})

describe('quoteTotals', () => {
  it('soma itens e frete e desconta', () => {
    assert.deepEqual(quoteTotals({ lineTotals: [1000, 500], freight: 200, discount: 100 }), {
      subtotal: 1500,
      total: 1600,
    })
  })

  it('trata frete em branco como zero, que é "a definir"', () => {
    assert.deepEqual(quoteTotals({ lineTotals: [1000], freight: null, discount: 0 }), { subtotal: 1000, total: 1000 })
  })

  it('devolve zero em orçamento sem item', () => {
    assert.deepEqual(quoteTotals({ lineTotals: [], freight: undefined, discount: 0 }), { subtotal: 0, total: 0 })
  })
})

describe('isDiscountTooLarge', () => {
  it('aceita desconto até o valor do orçamento com frete', () => {
    assert.equal(isDiscountTooLarge(1200, 1000, 200), false)
  })

  it('recusa desconto que deixaria o total negativo', () => {
    assert.equal(isDiscountTooLarge(1201, 1000, 200), true)
  })

  it('conta o frete em branco como zero', () => {
    assert.equal(isDiscountTooLarge(1001, 1000, null), true)
  })
})

describe('exceedsAmountLimit', () => {
  it('aceita valor no teto do Decimal(12,2)', () => {
    assert.equal(exceedsAmountLimit(MAX_QUOTE_AMOUNT, MAX_QUOTE_AMOUNT), false)
  })

  it('recusa acima do teto, em qualquer um dos dois valores', () => {
    assert.equal(exceedsAmountLimit(MAX_QUOTE_AMOUNT + 0.01, 0), true)
    assert.equal(exceedsAmountLimit(0, MAX_QUOTE_AMOUNT + 0.01), true)
  })
})
