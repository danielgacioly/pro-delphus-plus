import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { localize } from './catalogTranslation.js'

describe('localize', () => {
  it('usa o idioma do catálogo quando os dois existem', () => {
    assert.equal(localize('Heart set', 'Kit de coração', 'EN'), 'Heart set')
    assert.equal(localize('Heart set', 'Kit de coração', 'PT'), 'Kit de coração')
  })

  // Visto em produção: descrição cadastrada só em português aparecia como
  // "Sem descrição cadastrada" pra quem vê o catálogo em inglês.
  it('cai no outro idioma quando só um foi cadastrado', () => {
    assert.equal(localize(null, 'Kit de coração', 'EN'), 'Kit de coração')
    assert.equal(localize('', 'Kit de coração', 'EN'), 'Kit de coração')
    assert.equal(localize('Heart set', null, 'PT'), 'Heart set')
    assert.equal(localize('Heart set', '  ', 'PT'), 'Heart set')
  })

  it('devolve null quando nenhum foi cadastrado', () => {
    assert.equal(localize(null, null, 'EN'), null)
    assert.equal(localize('', '', 'PT'), null)
  })
})
