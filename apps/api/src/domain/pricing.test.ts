import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  exceedsAmountLimit,
  hasUsablePrice,
  isDiscountTooLarge,
  MAX_QUOTE_AMOUNT,
  quoteLineAmounts,
  quoteTotals,
} from './pricing.js'

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
