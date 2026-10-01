import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { componentsLine, skuLine } from './quoteI18n.js'

describe('componentsLine', () => {
  it('põe o rótulo no idioma do orçamento e envolve em parênteses', () => {
    assert.equal(componentsLine('EN', '1 MMT 0, 1 MMT 1'), '(Components: 1 MMT 0, 1 MMT 1)')
    assert.equal(componentsLine('PT', '1 MMT 0 e 1 MMT 1'), '(Componentes: 1 MMT 0 e 1 MMT 1)')
    assert.equal(componentsLine('ES', 'A, B'), '(Componentes: A, B)')
  })

  it('não repete o rótulo quando o texto já começa com ele', () => {
    assert.equal(componentsLine('EN', 'Components: A, B'), '(Components: A, B)')
    assert.equal(componentsLine('PT', 'componentes : A, B'), '(componentes : A, B)')
  })

  it('não duplica parênteses que já existam', () => {
    assert.equal(componentsLine('EN', '(A, B)'), '(Components: A, B)')
    assert.equal(componentsLine('EN', '(Components: A, B)'), '(Components: A, B)')
  })

  it('devolve vazio sem componentes', () => {
    assert.equal(componentsLine('EN', ''), '')
    assert.equal(componentsLine('EN', '  '), '')
    assert.equal(componentsLine('EN', null), '')
    assert.equal(componentsLine('EN', '()'), '')
  })
})

describe('skuLine', () => {
  it('mostra o código sem parênteses', () => {
    assert.equal(skuLine('MMT 01'), 'Cod. MMT 01')
    assert.equal(skuLine('  X1 '), 'Cod. X1')
  })

  it('devolve vazio quando o produto não tem SKU', () => {
    assert.equal(skuLine(''), '')
    assert.equal(skuLine('   '), '')
    assert.equal(skuLine(null), '')
  })
})
