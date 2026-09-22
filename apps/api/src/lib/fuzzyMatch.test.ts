import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bestMatches, levenshtein, similarity } from './fuzzyMatch.js'

describe('levenshtein', () => {
  it('vale zero pra strings idênticas', () => {
    assert.equal(levenshtein('thor', 'thor'), 0)
  })

  it('conta as trocas mínimas entre duas strings', () => {
    assert.equal(levenshtein('gato', 'pato'), 1)
    assert.equal(levenshtein('abc', ''), 3)
    assert.equal(levenshtein('', 'abc'), 3)
  })
})

describe('similarity', () => {
  it('vale 1 ignorando acento, caixa e espaço', () => {
    assert.equal(similarity('Mad Global', 'mad global'), 1)
    assert.equal(similarity('São Paulo', 'sao paulo'), 1)
  })

  it('reconhece nome de instituição parecido apesar do erro de digitação', () => {
    // Caso real que motivou isto: vendedor digitou "MediGlobal" querendo
    // dizer o cliente cadastrado como "Mad Global".
    assert.ok(similarity('MediGlobal', 'Mad Global') >= 0.6)
  })

  it('vale baixo pra strings sem nada em comum', () => {
    assert.ok(similarity('Thor', 'Zebra Corp') < 0.3)
  })
})

describe('bestMatches', () => {
  const clientes = [{ nome: 'Mad Global' }, { nome: 'Global Med Distribuidora' }, { nome: 'Hospital São Lucas' }]

  it('acha o mais parecido mesmo com erro de digitação', () => {
    const result = bestMatches('MediGlobal', clientes, (c) => c.nome, { limit: 1 })
    assert.deepEqual(result, [{ nome: 'Mad Global' }])
  })

  it('não sugere nada quando não há nada parecido o suficiente', () => {
    assert.deepEqual(bestMatches('Zebra Corp', clientes, (c) => c.nome), [])
  })

  it('respeita o limite e a ordem por semelhança', () => {
    const result = bestMatches('global', clientes, (c) => c.nome, { limit: 2, threshold: 0 })
    assert.equal(result.length, 2)
  })
})
