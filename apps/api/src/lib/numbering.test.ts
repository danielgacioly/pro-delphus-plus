import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { firstFreeNumber } from './numbering.js'

describe('firstFreeNumber', () => {
  it('devolve o próprio início quando está livre', () => {
    assert.equal(firstFreeNumber(460, [458, 459]), 460)
  })

  it('pula os números já usados, em sequência', () => {
    assert.equal(firstFreeNumber(460, [460, 461, 463]), 462)
  })
})
