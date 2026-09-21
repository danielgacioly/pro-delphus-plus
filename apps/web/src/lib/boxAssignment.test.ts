import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildBoxAssignments,
  clampLinesToBoxes,
  effectiveBoxCount,
  highestUsedBox,
  parseBoxCount,
  splitLine,
  type BoxLine,
} from './boxAssignment.js'

function line(id: string, box: number, quantity = 1, label = id): BoxLine {
  return { id, label, quantity, box }
}

describe('parseBoxCount', () => {
  it('lê um número de caixas válido', () => {
    assert.equal(parseBoxCount('1'), 1)
    assert.equal(parseBoxCount('12'), 12)
    assert.equal(parseBoxCount(' 3 '), 3)
  })

  it('devolve null para campo vazio, que é alguém no meio da digitação', () => {
    assert.equal(parseBoxCount(''), null)
    assert.equal(parseBoxCount('   '), null)
  })

  it('devolve null para o que não é número de caixa', () => {
    assert.equal(parseBoxCount('0'), null)
    assert.equal(parseBoxCount('-2'), null)
    assert.equal(parseBoxCount('1.5'), null)
    assert.equal(parseBoxCount('abc'), null)
  })
})

describe('clampLinesToBoxes', () => {
  it('traz para a última caixa o que ficou além do total', () => {
    const result = clampLinesToBoxes([line('a', 1), line('b', 3)], 2)
    assert.deepEqual(
      result.map((l) => l.box),
      [1, 2],
    )
  })

  it('não mexe em nada quando tudo cabe', () => {
    const lines = [line('a', 1), line('b', 2)]
    assert.deepEqual(clampLinesToBoxes(lines, 3), lines)
  })
})

describe('highestUsedBox', () => {
  it('encontra a caixa mais alta em uso', () => {
    assert.equal(highestUsedBox([line('a', 1), line('b', 4), line('c', 2)]), 4)
  })

  it('vale 1 sem nenhuma linha', () => {
    assert.equal(highestUsedBox([]), 1)
  })
})

describe('effectiveBoxCount', () => {
  it('usa o que está no campo quando ele comporta a distribuição', () => {
    assert.equal(effectiveBoxCount([line('a', 1)], '3'), 3)
  })

  it('nunca fica abaixo da caixa mais alta em uso', () => {
    // Regressão: com o campo vazio (alguém trocando "2" por "12"), montar o
    // payload por ele apagava do Packing List todo item acima da caixa 1.
    assert.equal(effectiveBoxCount([line('a', 1), line('b', 2)], ''), 2)
    assert.equal(effectiveBoxCount([line('a', 3)], '1'), 3)
  })
})

describe('buildBoxAssignments', () => {
  it('agrupa as linhas por caixa, na ordem das caixas', () => {
    const result = buildBoxAssignments([line('a', 1, 2), line('b', 2, 1), line('c', 1, 1)], 2)
    assert.deepEqual(result, [
      [
        { label: 'a', quantity: 2 },
        { label: 'c', quantity: 1 },
      ],
      [{ label: 'b', quantity: 1 }],
    ])
  })

  it('cria caixa vazia para a que foi declarada e não recebeu nada', () => {
    assert.deepEqual(buildBoxAssignments([line('a', 1)], 3), [[{ label: 'a', quantity: 1 }], [], []])
  })

  it('descarta linha sem rótulo ou com quantidade zerada, que o editor deixa existir', () => {
    const lines = [line('a', 1), { id: 'b', label: '  ', quantity: 5, box: 1 }, line('c', 1, 0)]
    assert.deepEqual(buildBoxAssignments(lines, 1), [[{ label: 'a', quantity: 1 }]])
  })

  it('não declara divisão nenhuma quando não há linha', () => {
    assert.equal(buildBoxAssignments([], 2), undefined)
  })

  it('tira espaço sobrando do rótulo digitado à mão', () => {
    assert.deepEqual(buildBoxAssignments([{ id: 'a', label: '  Thor  ', quantity: 1, box: 1 }], 1), [
      [{ label: 'Thor', quantity: 1 }],
    ])
  })
})

describe('splitLine', () => {
  it('divide a quantidade e manda a metade para a caixa seguinte', () => {
    const result = splitLine([line('a', 1, 4)], 'a', 1)
    assert.ok(result)
    assert.deepEqual(
      result.lines.map((l) => [l.quantity, l.box]),
      [
        [2, 1],
        [2, 2],
      ],
    )
  })

  it('abre a caixa seguinte quando ela ainda não existe', () => {
    assert.equal(splitLine([line('a', 1, 2)], 'a', 1)?.boxCount, 2)
  })

  it('não reduz o número de caixas já declarado', () => {
    assert.equal(splitLine([line('a', 1, 2)], 'a', 5)?.boxCount, 5)
  })

  it('divide quantidade ímpar sem perder unidade', () => {
    const result = splitLine([line('a', 1, 5)], 'a', 1)
    const total = result!.lines.reduce((sum, l) => sum + l.quantity, 0)
    assert.equal(total, 5)
  })

  it('recusa dividir uma unidade só e linha inexistente', () => {
    assert.equal(splitLine([line('a', 1, 1)], 'a', 1), null)
    assert.equal(splitLine([line('a', 1, 2)], 'inexistente', 1), null)
  })
})
