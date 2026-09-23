import { Field, Input, Textarea } from './ui'

export interface BuyerFieldsValue {
  purchaseOrder: string
  orderedByEmail: string
  shipDate: string
}

/**
 * Pedido de compra, e-mail do comprador, data de expedição — usados na mesma
 * tela, seja criando ou editando um pedido (NewOrder). O e-mail é obrigatório
 * nos dois casos porque a API exige (orderFieldsSchema em
 * apps/api/src/routes/orders.routes.ts).
 */
export function BuyerFields({
  value,
  onChange,
}: {
  value: BuyerFieldsValue
  onChange: (patch: Partial<BuyerFieldsValue>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Pedido de compra (opcional)" hint="Se vazio, usa o número do orçamento.">
        <Input value={value.purchaseOrder} onChange={(e) => onChange({ purchaseOrder: e.target.value })} />
      </Field>
      <Field label="E-mail do comprador">
        <Input
          type="email"
          required
          value={value.orderedByEmail}
          onChange={(e) => onChange({ orderedByEmail: e.target.value })}
        />
      </Field>
      <Field label="Data de expedição (opcional)">
        <Input type="date" value={value.shipDate} onChange={(e) => onChange({ shipDate: e.target.value })} />
      </Field>
    </div>
  )
}

export interface AddressFieldsValue {
  billToText: string
  shipToText: string
  shipToNote: string
}

/** Bill To / Ship To / observação de entrega. Os dois endereços saem impressos
 * no Invoice e na Packing List, então são obrigatórios tanto na criação quanto
 * na edição — a API rejeita ambos em branco. */
export function AddressFields({
  value,
  onChange,
}: {
  value: AddressFieldsValue
  onChange: (patch: Partial<AddressFieldsValue>) => void
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="Faturamento (Bill To)">
          <Textarea
            required
            rows={5}
            placeholder={'Attn: Nome\nEndereço\nCidade, Estado. País.\nCEP\nMail: ...\nTel: ...'}
            value={value.billToText}
            onChange={(e) => onChange({ billToText: e.target.value })}
          />
        </Field>
        <Field label="Entrega (Ship To)">
          <Textarea
            required
            rows={5}
            placeholder={'Attn: Nome - Empresa\nEndereço de entrega\n...'}
            value={value.shipToText}
            onChange={(e) => onChange({ shipToText: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Observação de entrega (opcional)"
        hint='ex: "HOLD FOR PICKUP – CUSTOMER WILL COLLECT AT DHL OFFICE"'
        className="mt-4"
      >
        <Input value={value.shipToNote} onChange={(e) => onChange({ shipToNote: e.target.value })} />
      </Field>
    </>
  )
}

export interface WeightFieldsValue {
  netWeightKg: string
  grossWeightKg: string
}

/**
 * Peso líquido/bruto. Devolvido sem wrapper de grid — NewOrder encaixa estes
 * dois campos junto com um terceiro (Via de envio/Incoterms) num grid de 3
 * colunas; este componente só evita repetir o par de <Field>.
 */
export function WeightFields({
  value,
  onChange,
}: {
  value: WeightFieldsValue
  onChange: (patch: Partial<WeightFieldsValue>) => void
}) {
  return (
    <>
      <Field label="Peso líquido (kg)">
        <Input
          type="number"
          step="0.001"
          className="tabular"
          value={value.netWeightKg}
          onChange={(e) => onChange({ netWeightKg: e.target.value })}
        />
      </Field>
      <Field label="Peso bruto (kg)">
        <Input
          type="number"
          step="0.001"
          className="tabular"
          value={value.grossWeightKg}
          onChange={(e) => onChange({ grossWeightKg: e.target.value })}
        />
      </Field>
    </>
  )
}

export interface InvoiceFieldsValue {
  nfNumber: string
  nfDate: string
}

/**
 * Número e data de emissão da NF. Sem wrapper de grid pelo mesmo motivo do
 * WeightFields — quem usa escolhe o grid.
 */
export function InvoiceFields({
  value,
  onChange,
}: {
  value: InvoiceFieldsValue
  onChange: (patch: Partial<InvoiceFieldsValue>) => void
}) {
  return (
    <>
      <Field label="Número da NF">
        <Input value={value.nfNumber} onChange={(e) => onChange({ nfNumber: e.target.value })} />
      </Field>
      <Field label="Data de emissão">
        <Input type="date" value={value.nfDate} onChange={(e) => onChange({ nfDate: e.target.value })} />
      </Field>
    </>
  )
}
