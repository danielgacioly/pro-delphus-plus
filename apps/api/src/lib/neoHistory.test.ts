import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recentHistory } from './neoHistory.js'

const turn = (i: number) => [
  { role: 'user', text: `pergunta ${i}` },
  { role: 'model', text: `resposta ${i}` },
]

describe('histórico enviado ao NEO', () => {
  it('manda a conversa inteira enquanto ela é curta', () => {
    const history = [...turn(1), ...turn(2)]
    assert.deepEqual(recentHistory(history, 16), history)
  })

  it('numa conversa longa, manda só as mensagens mais recentes', () => {
    const history = Array.from({ length: 20 }, (_, i) => turn(i)).flat()
    const recent = recentHistory(history, 4)
    assert.deepEqual(recent.map((m) => m.text), ['pergunta 18', 'resposta 18', 'pergunta 19', 'resposta 19'])
  })

  it('nunca começa com uma resposta do NEO solta, sem a pergunta que a originou', () => {
    const history = [...turn(1), ...turn(2)]
    const recent = recentHistory(history, 3)
    assert.equal(recent[0]?.role, 'user')
    assert.deepEqual(recent.map((m) => m.text), ['pergunta 2', 'resposta 2'])
  })
})
