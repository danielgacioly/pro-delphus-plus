import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { componentsLine, itemBody } from './quoteI18n.js'

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

describe('itemBody', () => {
  it('fecha o texto do item com o código do produto', () => {
    assert.equal(itemBody('PT', { description: 'Simulador', components: '', sku: 'MMT 01' }), 'Simulador (Cod. MMT 01)')
    assert.equal(
      itemBody('EN', { description: 'Simulator', components: 'A, B', sku: 'X1' }),
      'Simulator\n(Components: A, B) (Cod. X1)',
    )
    assert.equal(itemBody('PT', { description: '', components: '', sku: 'X1' }), '(Cod. X1)')
  })

  it('não põe nada quando o produto não tem SKU', () => {
    assert.equal(itemBody('PT', { description: 'Simulador', components: '', sku: '' }), 'Simulador')
    assert.equal(itemBody('PT', { description: 'Simulador', components: '', sku: '   ' }), 'Simulador')
  })
})
