import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { contentTokens, cosineSimilarity, lexicalScore, rankLibraryEntries } from './librarySearch.js'

describe('palavras de conteúdo da busca da Biblioteca', () => {
  it('ignora acento, caixa, plural simples e palavras que qualquer pergunta tem', () => {
    assert.deepEqual(contentTokens('O simulador tem Incisões de pele?'), ['incisoe', 'pele'])
  })
})

describe('coincidência de palavras', () => {
  it('reconhece a mesma raiz escrita de outro jeito', () => {
    assert.equal(lexicalScore('dá pra suturar?', 'O modelo aceita sutura com fio 3-0'), 1)
  })

  it('tolera erro de digitação em palavra longa', () => {
    assert.equal(lexicalScore('laparoscopai', 'Serve para laparoscopia'), 1)
  })

  it('não conta pergunta feita só de palavras genéricas', () => {
    assert.equal(lexicalScore('o simulador tem isso?', 'O simulador tem pele'), 0)
  })
})

describe('ranqueamento', () => {
  const entries = [
    { id: 'hemorragia', text: 'Simula hemorragia? Sim, com sangue artificial', embedding: [1, 0, 0] },
    { id: 'garantia', text: 'Qual a garantia? 1 ano', embedding: [0, 1, 0] },
    { id: 'sem-vetor', text: 'Tem sangramento arterial? Não', embedding: null },
  ]

  it('acha a pergunta pelo significado mesmo sem nenhuma palavra em comum', () => {
    const ranked = rankLibraryEntries('dá pra ver sair sangue?', [0.98, 0.05, 0], entries)
    assert.equal(ranked[0]?.id, 'hemorragia')
    assert.equal(ranked[0]?.match, 'strong')
    assert.ok(!ranked.some((r) => r.id === 'garantia'))
  })

  it('compara pelas palavras a entrada que ainda não tem vetor', () => {
    const ranked = rankLibraryEntries('sangramento', [0.98, 0.05, 0], entries)
    assert.ok(ranked.some((r) => r.id === 'sem-vetor'))
  })

  it('cai para a busca por palavras quando o Gemini não devolveu o vetor da busca', () => {
    const ranked = rankLibraryEntries('garantia', null, entries)
    assert.deepEqual(
      ranked.map((r) => r.id),
      ['garantia'],
    )
  })

  it('não devolve nada quando nada é do mesmo assunto', () => {
    assert.deepEqual(rankLibraryEntries('preço do frete', [0, 0, 1], entries), [])
  })
})

describe('cosseno', () => {
  it('dá 0 para vetores de tamanhos diferentes (modelos diferentes não se comparam)', () => {
    assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0)
  })
})
