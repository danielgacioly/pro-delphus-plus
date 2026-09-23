import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { saidYesToDefault } from './neoConsent.js'

describe('saidYesToDefault', () => {
  it('aceita um "sim" ao padrão', () => {
    for (const t of ['Sim', 'sim, pode usar o padrão', 'Pode', 'usa o padrão mesmo', 'ok', 'Quero o padrão']) {
      assert.equal(saidYesToDefault(t), true, t)
    }
  })

  it('recusa negativa ou pedido de customizar', () => {
    for (const t of ['Não', 'não, quero customizar', 'nao quero o padrao', 'quero uma descrição diferente', 'muda os componentes']) {
      assert.equal(saidYesToDefault(t), false, t)
    }
  })

  it('não conta o pedido original de orçamento como autorização', () => {
    assert.equal(saidYesToDefault('Monta um orçamento pro cliente Carlos Andrade com 1 Thor. Internacional, USD, inglês, preço final.'), false)
  })
})
