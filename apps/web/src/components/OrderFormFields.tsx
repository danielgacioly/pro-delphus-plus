import { Field, Input, Textarea } from './ui'

export interface BuyerFieldsValue {
  purchaseOrder: string
  orderedByEmail: string
  shipDate: string
}

/**
 * Pedido de compra, e-mail do comprador, data de expedição — usado tanto na
 * criação (NewOrder) quanto na edição (OrderDetail) de pedidos.
 *
 * `variant` só controla diferenças que já existiam entre as duas telas antes
 * desta extração (texto de apoio e o e-mail sendo obrigatório só na
 * criação) — não introduz nenhuma regra nova.
 */
export function BuyerFields({
  value,
  onChange,
  variant,
}: {
  value: BuyerFieldsValue
  onChange: (patch: Partial<BuyerFieldsValue>) => void
  variant: 'create' | 'edit'
}) {
  const isCreate = variant === 'create'
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label={isCreate ? 'Pedido de compra (opcional)' : 'Pedido de compra'}
        hint={isCreate ? 'Se vazio, usa o número do orçamento.' : undefined}
      >
        <Input value={value.purchaseOrder} onChange={(e) => onChange({ purchaseOrder: e.target.value })} />
      </Field>
      <Field label="E-mail do comprador">
        <Input
          type="email"
          required={isCreate}
          value={value.orderedByEmail}
          onChange={(e) => onChange({ orderedByEmail: e.target.value })}
        />
      </Field>
      <Field label={isCreate ? 'Data de expedição (opcional)' : 'Data de expedição'}>
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

/** Bill To / Ship To / observação de entrega. Mesma regra de `variant` acima:
 * NewOrder exige preenchimento e mostra placeholder de exemplo; OrderDetail
 * (edição) não exige — o pedido já existe, os campos já vieram preenchidos. */
export function AddressFields({
  value,
  onChange,
  variant,
}: {
  value: AddressFieldsValue
  onChange: (patch: Partial<AddressFieldsValue>) => void
  variant: 'create' | 'edit'
}) {
  const isCreate = variant === 'create'
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Faturamento (Bill To)">
          <Textarea
            required={isCreate}
            rows={5}
            placeholder={
              isCreate ? 'Attn: Nome\nEndereço\nCidade, Estado. País.\nCEP\nMail: ...\nTel: ...' : undefined
            }
            value={value.billToText}
            onChange={(e) => onChange({ billToText: e.target.value })}
          />
        </Field>
        <Field label="Entrega (Ship To)">
          <Textarea
            required={isCreate}
            rows={5}
            placeholder={isCreate ? 'Attn: Nome - Empresa\nEndereço de entrega\n...' : undefined}
            value={value.shipToText}
            onChange={(e) => onChange({ shipToText: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Observação de entrega (opcional)"
        hint={isCreate ? 'ex: "HOLD FOR PICKUP – CUSTOMER WILL COLLECT AT DHL OFFICE"' : undefined}
        className={isCreate ? 'mt-4' : undefined}
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
 * colunas; OrderDetail usa um grid próprio de 2. Cada página mantém o grid
 * que já tem; este componente só evita duplicar o par de <Field>.
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
 * WeightFields — NewOrder usa `grid-cols-1 sm:grid-cols-2` (responsivo),
 * OrderDetail usa `grid-cols-2` fixo; unificar isso mudaria o comportamento
 * em telas estreitas numa das duas, fora do escopo desta extração.
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
