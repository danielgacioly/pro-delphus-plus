import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatOrderNumber, type OrderDTO } from '@prodelphusplus/shared'
import { api, getErrorMessage } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal } from './Modal'
import { Alert, Button, Field, Input } from './ui'

/**
 * Troca o número do Invoice de um pedido à mão. Só muda o que é exibido e
 * impresso (`invoiceNumber`): a sequência continua em `orderNumber`, e o
 * próximo pedido criado segue dela normalmente. Salvar regenera os documentos.
 */
export function EditInvoiceNumberModal({ order, onClose }: { order: OrderDTO; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [value, setValue] = useState(String(order.invoiceNumber ?? order.orderNumber))
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async (invoiceNumber: number | null) => {
      const { data } = await api.patch<{ order: OrderDTO }>(`/orders/${order.id}`, { invoiceNumber })
      return data.order
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', order.id] })
      toast.success(`Número do pedido agora é #${formatOrderNumber(updated.invoiceNumber ?? updated.orderNumber)}.`)
      onClose()
    },
    onError: (err: unknown) => setError(getErrorMessage(err, 'Não foi possível trocar o número.')),
  })

  function submit() {
    const digits = value.trim()
    if (!/^\d{1,8}$/.test(digits)) {
      setError('Digite só números (até 8 dígitos).')
      return
    }
    const number = Number(digits)
    // Digitar o próprio número da sequência é o mesmo que voltar ao original.
    save.mutate(number === order.orderNumber ? null : number)
  }

  return (
    <Modal onClose={save.isPending ? undefined : onClose} dismissOnBackdrop={!save.isPending}>
      <form
        className="animate-scale-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2 className="text-base font-semibold text-ink-900">Número do pedido</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Sai no Invoice, na Packing List e nos nomes dos arquivos. A sequência não muda: o próximo pedido continua
          a partir de #{formatOrderNumber(order.orderNumber)}.
        </p>

        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <Field label="Número" className="mt-4" hint="Os documentos são gerados de novo com o número novo.">
          <Input
            autoFocus
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, ''))
              setError(null)
            }}
            className="tabular"
          />
        </Field>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {order.invoiceNumber !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => save.mutate(null)}
              className="mr-auto"
            >
              Voltar ao #{formatOrderNumber(order.orderNumber)}
            </Button>
          )}
          <Button type="button" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
