import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { confirmedUpFront, isPlainYesToDefault, saidYesToDefault } from './neoConsent.js'

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
    assert.equal(saidYesToDefault('Bom dia! Manda um orçamento pro Carlos Andrade, vamos fechar com 1 Thor'), false)
  })

  // Visto ao vivo: o padrão estava pedido no próprio pedido, no plural e sem
  // acento, e o NEO perguntou de novo.
  it('aceita o padrão pedido já no pedido do orçamento, no plural e sem acento', () => {
    const pedido =
      'Neo, monta um orçamento p mim p a Ximena Gomez, Com 1 unidade do thor, internacional em usd final, descricao e componentes padroes, em ingles. Confirmo a geração do orçamento'
    assert.equal(saidYesToDefault(pedido), true)
  })
})

describe('confirmedUpFront', () => {
  it('reconhece a confirmação da gravação feita já na mensagem', () => {
    for (const t of [
      'Confirmo a geração do orçamento',
      'confirmo o pedido',
      'pode gerar direto',
      'pode criar sem perguntar',
      'cria direto',
      'monta o orçamento sem precisar confirmar',
    ]) {
      assert.equal(confirmedUpFront(t), true, t)
    }
  })

  it('não confunde confirmar outra coisa com autorizar a gravação', () => {
    for (const t of ['confirmo, é internacional', 'sim', 'pode usar o padrão', 'não confirmo a geração', 'monta um orçamento pra Ximena']) {
      assert.equal(confirmedUpFront(t), false, t)
    }
  })
})

describe('isPlainYesToDefault', () => {
  it('aceita qualquer afirmativa como resposta à pergunta do padrão', () => {
    for (const t of [
      'sim',
      'Sim!',
      'pode usar o padrão',
      'ok',
      'sim, pode gravar direto',
      'usa o padrão nos dois',
      'manda ver',
      'pode seguir',
      'beleza, pode ser',
      'tá ótimo',
      'perfeito',
      'fechado, grava direto',
      '👍',
    ]) {
      assert.equal(isPlainYesToDefault(t), true, t)
    }
  })

  // Visto ao vivo: um pedido novo gravava o rascunho da conversa anterior.
  it('recusa pedido novo, condição, pergunta e negativa', () => {
    for (const t of [
      'Faz um orçamento nacional pro Dr. Rafael Teste com 1 HOP difficult access, descrição e componentes padrão, pode gravar direto',
      'sim, mas com 3 unidades',
      'pode, só que troca o cliente',
      'não',
      'não precisa, eu digo a descrição',
      'qual é a descrição?',
      'sim, 2 unidades',
    ]) {
      assert.equal(isPlainYesToDefault(t), false, t)
    }
  })
})
