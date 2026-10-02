import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { finalizeDecimal, sanitizeDecimal } from './decimalField.js'

describe('sanitizeDecimal', () => {
  it('aceita vírgula como separador decimal', () => {
    assert.equal(sanitizeDecimal('1250,5', 2), '1250.5')
  })

  it('não deixa passar casas além do limite', () => {
    assert.equal(sanitizeDecimal('99.999', 2), '99.99')
    assert.equal(sanitizeDecimal('0,001', 2), '0.00')
    assert.equal(sanitizeDecimal('5.12345', 4), '5.1234')
  })

  it('entende número colado com milhar em português', () => {
    assert.equal(sanitizeDecimal('1.234,56', 2), '1234.56')
  })

  it('descarta letras, sinais e pontos repetidos', () => {
    assert.equal(sanitizeDecimal('R$ -12a.5.0', 2), '12.50')
    assert.equal(sanitizeDecimal(',5', 2), '0.5')
  })

  it('mantém inteiro e campo vazio como estão', () => {
    assert.equal(sanitizeDecimal('300', 2), '300')
    assert.equal(sanitizeDecimal('', 2), '')
  })
})

describe('finalizeDecimal', () => {
  it('tira o ponto solto no fim', () => {
    assert.equal(finalizeDecimal('12.'), '12')
    assert.equal(finalizeDecimal('12.5'), '12.5')
  })
})
