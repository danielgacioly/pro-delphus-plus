import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { neoThinkingFor } from './neoThinking.js'

describe('quanto o NEO raciocina', () => {
  it('fica no mínimo em consulta de catálogo, cliente e Biblioteca', () => {
    assert.equal(neoThinkingFor('quais produtos de laparoscopia vocês têm?'), 'low')
    assert.equal(neoThinkingFor('o Dr. Smith está em atendimento?'), 'low')
    assert.equal(neoThinkingFor('o Mastotrainer simula sangramento?'), 'low')
  })

  it('raciocina mais com desconto, que exige escolher o campo e fazer conta', () => {
    assert.equal(neoThinkingFor('dá 10% no total'), 'medium')
    assert.equal(neoThinkingFor('coloca um desconto no LAB-COR'), 'medium')
  })

  it('raciocina mais ao montar ou editar orçamento e pedido', () => {
    assert.equal(neoThinkingFor('monta um orçamento pro cliente da Malásia'), 'medium')
    assert.equal(neoThinkingFor('troca a quantidade para 3'), 'medium')
  })

  it('raciocina mais quando a pessoa responde uma pergunta de pedido, mesmo sem palavra-chave na resposta', () => {
    assert.equal(neoThinkingFor('3, PayPal', 'Quantas caixas e qual a forma de pagamento?'), 'medium')
  })

  it('não confunde palavra parecida com campo do pedido', () => {
    assert.equal(neoThinkingFor('qual a especialidade do Dr. Nunes?'), 'low')
  })
})
