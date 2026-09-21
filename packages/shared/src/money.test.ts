import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { invoiceTotal } from './money.js'

describe('invoiceTotal', () => {
  const base = { subtotal: 2500, freight: 100, discount: 50, paypalFee: 80 }

  it('soma a taxa do PayPal quando é a forma de pagamento', () => {
    assert.equal(invoiceTotal({ ...base, prepaymentBy: 'PAYPAL' }), 2630)
  })

  it('ignora taxa guardada de uma escolha anterior nas outras formas de pagamento', () => {
    // Regressão: o pedido guarda a taxa mesmo depois de trocar a forma de
    // pagamento, e o Invoice somava esse resto sem imprimir a linha
    // correspondente — documento que não fechava com as próprias contas.
    assert.equal(invoiceTotal({ ...base, prepaymentBy: 'WIRE_TRANSFER' }), 2550)
    assert.equal(invoiceTotal({ ...base, prepaymentBy: 'PIX' }), 2550)
  })

  it('trata frete e taxa em branco como zero', () => {
    assert.equal(
      invoiceTotal({ subtotal: 1000, freight: null, discount: 0, prepaymentBy: 'PAYPAL', paypalFee: null }),
      1000,
    )
  })

  it('desconta antes da taxa, como o documento imprime', () => {
    assert.equal(
      invoiceTotal({ subtotal: 1000, freight: 0, discount: 100, prepaymentBy: 'PAYPAL', paypalFee: 50 }),
      950,
    )
  })
})
