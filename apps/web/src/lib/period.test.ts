import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isInCurrentMonth, isInPreviousWindow, monthWindow, variation } from './period.js'

/** Uma data local, para os testes falarem a mesma língua de `new Date(ano, mes, dia)`. */
function local(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour)
}

describe('monthWindow', () => {
  it('abre a janela anterior no primeiro dia do mês passado', () => {
    const w = monthWindow(local(2026, 3, 10))
    assert.equal(new Date(w.previousStart).getMonth(), 1)
    assert.equal(new Date(w.previousStart).getDate(), 1)
  })

  it('compara o mesmo número de dias corridos', () => {
    const w = monthWindow(local(2026, 4, 6))
    // 5 dias e meio corridos em abril => mesma fatia a partir de 1º de março.
    assert.equal(new Date(w.previousEnd).getMonth(), 2)
    assert.equal(new Date(w.previousEnd).getDate(), 6)
  })

  it('não deixa a janela anterior invadir o mês corrente quando o mês passado é mais curto', () => {
    // Regressão: em 30/03 a janela de fevereiro ia até 2 de março, e registros
    // deste mês entravam na base contra a qual estão sendo comparados.
    const w = monthWindow(local(2026, 3, 30))
    assert.equal(w.previousEnd, w.start)
    assert.ok(w.previousEnd <= w.start)
  })

  it('no primeiro instante do mês, a janela anterior é vazia', () => {
    const w = monthWindow(new Date(2026, 5, 1, 0, 0, 0, 0))
    assert.equal(w.previousEnd, w.previousStart)
  })

  it('atravessa a virada de ano', () => {
    const w = monthWindow(local(2026, 1, 15))
    const previous = new Date(w.previousStart)
    assert.equal(previous.getFullYear(), 2025)
    assert.equal(previous.getMonth(), 11)
  })
})

describe('isInCurrentMonth', () => {
  const w = monthWindow(local(2026, 3, 10))

  it('aceita data deste mês e recusa a do mês passado', () => {
    assert.equal(isInCurrentMonth(w, local(2026, 3, 1, 0).toISOString()), true)
    assert.equal(isInCurrentMonth(w, local(2026, 3, 9).toISOString()), true)
    assert.equal(isInCurrentMonth(w, local(2026, 2, 28).toISOString()), false)
  })
})

describe('isInPreviousWindow', () => {
  const w = monthWindow(local(2026, 3, 10))

  it('aceita data dentro do trecho comparável', () => {
    assert.equal(isInPreviousWindow(w, local(2026, 2, 1, 0).toISOString()), true)
    assert.equal(isInPreviousWindow(w, local(2026, 2, 9).toISOString()), true)
  })

  it('recusa o que passou do trecho comparável, ainda que no mesmo mês', () => {
    assert.equal(isInPreviousWindow(w, local(2026, 2, 25).toISOString()), false)
  })

  it('recusa data anterior ao mês passado e data deste mês', () => {
    assert.equal(isInPreviousWindow(w, local(2026, 1, 20).toISOString()), false)
    assert.equal(isInPreviousWindow(w, local(2026, 3, 5).toISOString()), false)
  })

  it('não conta o mesmo registro nas duas janelas', () => {
    const window = monthWindow(local(2026, 3, 30))
    for (const day of [1, 15, 28]) {
      const iso = local(2026, 3, day).toISOString()
      assert.equal(isInCurrentMonth(window, iso) && isInPreviousWindow(window, iso), false, `dia ${day}`)
    }
  })
})

describe('variation', () => {
  it('calcula alta e queda em porcentagem', () => {
    assert.equal(variation(150, 100), 50)
    assert.equal(variation(50, 100), -50)
    assert.equal(variation(100, 100), 0)
  })

  it('devolve null sem base de comparação, em vez de dividir por zero', () => {
    assert.equal(variation(10, 0), null)
    assert.equal(variation(0, 0), null)
  })
})
