import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatAmount, formatOrderNumber } from './format.js'

describe('formatAmount', () => {
  it('sempre mostra duas casas, com separador de milhar', () => {
    assert.equal(formatAmount(40_902.77), '40,902.77')
    assert.equal(formatAmount(1000), '1,000.00')
    assert.equal(formatAmount(0), '0.00')
  })

  it('aceita o decimal vindo do banco como string', () => {
    assert.equal(formatAmount('2500'), '2,500.00')
    assert.equal(formatAmount('2500.5'), '2,500.50')
  })

  it('arredonda o que passa de duas casas', () => {
    assert.equal(formatAmount(1.005), '1.01')
    assert.equal(formatAmount(1.004), '1.00')
  })
})

describe('formatOrderNumber', () => {
  it('completa com zeros até quatro dígitos', () => {
    assert.equal(formatOrderNumber(0), '0000')
    assert.equal(formatOrderNumber(23), '0023')
  })

  it('não trunca número acima de quatro dígitos', () => {
    assert.equal(formatOrderNumber(12_345), '12345')
  })
})
