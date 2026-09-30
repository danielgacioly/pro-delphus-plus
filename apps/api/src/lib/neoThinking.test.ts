import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { neoThinkingFor } from './neoThinking.js'

describe('quanto o NEO raciocina', () => {
  it('fica no mínimo em consulta de catálogo, cliente e Biblioteca', () => {
    assert.equal(neoThinkingFor('quais produtos de laparoscopia vocês têm?'), 'low')
    assert.equal(neoThinkingFor('o Dr. Smith está em atendimento?'), 'low')
    assert.equal(neoThinkingFor('o Mastotrainer simula sangramento?'), 'low')
  })

  it('fica no mínimo ao montar orçamento, pedido ou cliente simples', () => {
    assert.equal(neoThinkingFor('monta um orçamento pro cliente da Malásia com 2 LAB-COR'), 'low')
    assert.equal(neoThinkingFor('orçamento nacional pro Carlos com 1 Thor, descrição e componentes padrão'), 'low')
    assert.equal(neoThinkingFor('3 caixas, PayPal, DAP'), 'low')
    assert.equal(neoThinkingFor('cadastra o Dr. Rafael, do Hospital X'), 'low')
  })

  it('raciocina mais com desconto e preço especial, que exigem escolher o campo e fazer conta', () => {
    assert.equal(neoThinkingFor('dá 10% no total'), 'medium')
    assert.equal(neoThinkingFor('coloca um desconto no LAB-COR'), 'medium')
    assert.equal(neoThinkingFor('o Thor por R$ 12.000'), 'medium')
  })

  it('raciocina mais ao editar algo que já existe', () => {
    assert.equal(neoThinkingFor('troca a quantidade para 3'), 'medium')
    assert.equal(neoThinkingFor('muda o orçamento 260930-06 pra 2 unidades'), 'medium')
  })

  it('raciocina mais com descrição ditada e com várias caixas', () => {
    assert.equal(neoThinkingFor('não, a descrição é "Venipuncture hand trainer"'), 'medium')
    assert.equal(neoThinkingFor('caixa 1 com 2 Thor e caixa 2 com o LAB-COR'), 'medium')
  })

  it('ignora campo em branco dos modelos de atalho, mas não campo preenchido', () => {
    const modelo = 'Monta um orçamento:\nCliente: Carlos\nItens (quantidade × produto): 1 Thor\nFrete: \nDesconto: '
    assert.equal(neoThinkingFor(modelo), 'low')
    assert.equal(neoThinkingFor(modelo.replace('Desconto: ', 'Desconto: 10%')), 'medium')
  })

  it('não confunde palavra parecida com campo do pedido', () => {
    assert.equal(neoThinkingFor('qual a especialidade do Dr. Nunes?'), 'low')
  })
})
