import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { missingPostOrderDocs, prepaymentRejection } from './orderDocuments.js'

describe('prepaymentRejection', () => {
  it('aceita transferência bancária nos dois tipos de venda', () => {
    assert.equal(prepaymentRejection('WIRE_TRANSFER', true), null)
    assert.equal(prepaymentRejection('WIRE_TRANSFER', false), null)
  })

  it('aceita Pix só em venda nacional', () => {
    assert.equal(prepaymentRejection('PIX', true), null)
    assert.match(prepaymentRejection('PIX', false) ?? '', /Pix não se aplica/)
  })

  it('aceita PayPal só em exportação', () => {
    assert.equal(prepaymentRejection('PAYPAL', false), null)
    assert.match(prepaymentRejection('PAYPAL', true) ?? '', /PayPal não se aplica/)
  })
})

describe('missingPostOrderDocs', () => {
  const pending = { status: 'PENDING' as const, awbNumber: null, nfNumber: null }

  it('exportação pendente pede AWB e Nota Fiscal', () => {
    assert.deepEqual(missingPostOrderDocs(pending, 'INTERNATIONAL'), ['AWB', 'Nota Fiscal'])
  })

  it('venda nacional não pede AWB', () => {
    assert.deepEqual(missingPostOrderDocs(pending, 'NATIONAL'), ['Nota Fiscal'])
  })

  it('cobra só o que ainda falta', () => {
    assert.deepEqual(missingPostOrderDocs({ ...pending, awbNumber: '123' }, 'INTERNATIONAL'), ['Nota Fiscal'])
    assert.deepEqual(missingPostOrderDocs({ ...pending, nfNumber: '456' }, 'NATIONAL'), [])
  })

  it('pedido concluído não tem pendência, mesmo sem documento nenhum', () => {
    assert.deepEqual(missingPostOrderDocs({ ...pending, status: 'COMPLETED' }, 'INTERNATIONAL'), [])
  })
})
