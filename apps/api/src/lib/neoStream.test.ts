import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IdRedactingStream, neoToolStatus } from './neoStream.js'

describe('texto do NEO em streaming', () => {
  it('entrega o texto inteiro, pedaço por pedaço', () => {
    const stream = new IdRedactingStream()
    const out = ['O orçamento ', 'ficou em R$ 1.200,00 ', 'para o cliente, com frete incluso.'].map((t) => stream.push(t)).join('')
    assert.equal(out + stream.flush(), 'O orçamento ficou em R$ 1.200,00 para o cliente, com frete incluso.')
  })

  it('nunca deixa um id interno partido entre dois pedaços chegar à tela', () => {
    const stream = new IdRedactingStream()
    const id = '3f1c2b7e-9a4d-4c21-8f3e-1b2c3d4e5f60'
    const out = [`Achei o produto ${id.slice(0, 20)}`, `${id.slice(20)} no catálogo.`].map((t) => stream.push(t)).join('')
    const full = out + stream.flush()
    assert.ok(!full.includes(id.slice(0, 8)))
    assert.equal(full, 'Achei o produto (id interno) no catálogo.')
  })
})

describe('aviso do que o NEO está fazendo', () => {
  it('diz a ação de cada ferramenta, sem repetir', () => {
    assert.equal(neoToolStatus(['buscar_cliente', 'buscar_produtos', 'buscar_produtos']), 'Buscando cliente e buscando produtos…')
  })

  it('tem um aviso genérico para ferramenta nova sem rótulo', () => {
    assert.equal(neoToolStatus(['ferramenta_nova']), 'Consultando o sistema…')
  })
})
