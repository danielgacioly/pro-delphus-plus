import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clientPrefixLabel, isBrazilianCountry } from './clients.js'

describe('isBrazilianCountry', () => {
  it('reconhece as grafias usadas no cadastro, sem ligar para caixa e espaço', () => {
    for (const country of ['Brasil', 'brazil', ' BR ', 'BRASIL']) {
      assert.equal(isBrazilianCountry(country), true, country)
    }
  })

  it('não reconhece outro país nem campo vazio', () => {
    assert.equal(isBrazilianCountry('France'), false)
    assert.equal(isBrazilianCountry(''), false)
    assert.equal(isBrazilianCountry(null), false)
    assert.equal(isBrazilianCountry(undefined), false)
  })
})

describe('clientPrefixLabel', () => {
  it('não trata quem não pediu tratamento', () => {
    assert.equal(clientPrefixLabel('NONE', 'Brasil', 'PT'), '')
  })

  it('usa a nacionalidade do cliente, não o idioma do documento', () => {
    // Cliente brasileiro num orçamento em inglês continua Sr./Sra.
    assert.equal(clientPrefixLabel('MR', 'Brasil', 'EN'), 'Sr.')
    assert.equal(clientPrefixLabel('MS', 'Brasil', 'EN'), 'Sra.')
    // Cliente estrangeiro num orçamento em português continua Mr./Ms.
    assert.equal(clientPrefixLabel('MR', 'France', 'PT'), 'Mr.')
    assert.equal(clientPrefixLabel('MS', 'France', 'PT'), 'Ms.')
  })

  it('sem cliente cadastrado, cai no idioma do orçamento como única pista', () => {
    assert.equal(clientPrefixLabel('MR', null, 'PT'), 'Sr.')
    assert.equal(clientPrefixLabel('MR', null, 'ES'), 'Sr.')
    assert.equal(clientPrefixLabel('MR', null, 'EN'), 'Mr.')
  })
})
