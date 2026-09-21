import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { boxAssignmentsFit, buildBoxPages, formatPackageCountLabel } from './packaging.js'

describe('formatPackageCountLabel', () => {
  it('usa singular numa caixa e plural acima disso', () => {
    assert.equal(formatPackageCountLabel(1), '01 Carton')
    assert.equal(formatPackageCountLabel(2), '02 Cartons')
  })

  it('mantém dois dígitos até 9 e não trunca acima de 99', () => {
    assert.equal(formatPackageCountLabel(9), '09 Cartons')
    assert.equal(formatPackageCountLabel(120), '120 Cartons')
  })
})

describe('boxAssignmentsFit', () => {
  it('aceita divisão sem caixa sobrando', () => {
    assert.equal(boxAssignmentsFit([[{ label: 'Thor', quantity: 1 }], []], 2), true)
  })

  it('aceita divisão com menos listas que caixas', () => {
    assert.equal(boxAssignmentsFit([[{ label: 'Thor', quantity: 1 }]], 3), true)
  })

  it('recusa divisão com mais listas que caixas, que sumiria do Packing List', () => {
    assert.equal(boxAssignmentsFit([[], [], []], 2), false)
  })

  it('aceita pedido sem divisão declarada', () => {
    assert.equal(boxAssignmentsFit(null, 1), true)
    assert.equal(boxAssignmentsFit(undefined, 4), true)
  })
})

describe('buildBoxPages', () => {
  const docItems = [
    { title: 'Thor', quantity: 2 },
    { title: 'ETX-6', quantity: 1 },
  ]

  it('sem divisão, coloca tudo na caixa 1 e deixa as outras vazias', () => {
    const pages = buildBoxPages(3, null, docItems)
    assert.equal(pages.length, 3)
    assert.deepEqual(pages[0], { boxNumber: 1, totalBoxes: 3, items: docItems })
    assert.deepEqual(pages[1]!.items, [])
    assert.deepEqual(pages[2]!.items, [])
  })

  it('trata divisão vazia como divisão ausente', () => {
    assert.deepEqual(buildBoxPages(1, [], docItems)[0]!.items, docItems)
  })

  it('respeita a divisão declarada, traduzindo rótulo para título impresso', () => {
    const pages = buildBoxPages(
      2,
      [
        [{ label: 'Thor', quantity: 1 }],
        [
          { label: 'Thor', quantity: 1 },
          { label: 'ETX-6', quantity: 1 },
        ],
      ],
      docItems,
    )
    assert.deepEqual(pages[0]!.items, [{ title: 'Thor', quantity: 1 }])
    assert.deepEqual(pages[1]!.items, [
      { title: 'Thor', quantity: 1 },
      { title: 'ETX-6', quantity: 1 },
    ])
  })

  it('gera página vazia para a caixa declarada sem itens atribuídos', () => {
    const pages = buildBoxPages(3, [[{ label: 'Thor', quantity: 1 }]], docItems)
    assert.equal(pages.length, 3)
    assert.deepEqual(pages[1]!.items, [])
    assert.deepEqual(pages[2]!.items, [])
  })

  it('numera as páginas a partir de 1 e repete o total em todas', () => {
    const pages = buildBoxPages(2, null, docItems)
    assert.deepEqual(
      pages.map((p) => [p.boxNumber, p.totalBoxes]),
      [
        [1, 2],
        [2, 2],
      ],
    )
  })
})
