import { useState, type FormEvent } from 'react'
import type { ClientDTO, ClientKind, ClientPrefix } from '@prodelphusplus/shared'
import { Button, Field, Input, Select, Textarea } from './ui'

export interface ClientFormValues {
  kind: ClientKind
  prefix: ClientPrefix
  name: string
  institution: string
  email: string
  phone: string
  taxId: string
  website: string
  country: string
  state: string
  city: string
  billToText: string
  shipToText: string
  notes: string
}

export const emptyClientForm: ClientFormValues = {
  kind: 'INDIVIDUAL',
  prefix: 'NONE',
  name: '',
  institution: '',
  email: '',
  phone: '',
  taxId: '',
  website: '',
  country: '',
  state: '',
  city: '',
  billToText: '',
  shipToText: '',
  notes: '',
}

export function clientToForm(client: ClientDTO): ClientFormValues {
  return {
    kind: client.kind,
    prefix: client.prefix,
    name: client.name,
    institution: client.institution ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    taxId: client.taxId ?? '',
    website: client.website ?? '',
    country: client.country ?? '',
    state: client.state ?? '',
    city: client.city ?? '',
    billToText: client.billToText ?? '',
    shipToText: client.shipToText ?? '',
    notes: client.notes ?? '',
  }
}

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = {
  INDIVIDUAL: 'Pessoa',
  INSTITUTION: 'Instituição',
  DISTRIBUTOR: 'Distribuidor',
}

/**
 * Cadastro de cliente. Usado tanto na página de Clientes quanto no fluxo de
 * orçamento, onde o vendedor precisa criar o cliente sem sair da tela — por
 * isso o formulário é um componente, não uma página.
 *
 * `compact` corta o formulário no essencial (identificação + contato); os
 * endereços de faturamento e entrega ficam para a edição completa.
 */
export function ClientForm({
  initial = emptyClientForm,
  compact,
  submitLabel = 'Salvar cliente',
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: ClientFormValues
  compact?: boolean
  submitLabel?: string
  isPending?: boolean
  error?: string | null
  onSubmit: (values: ClientFormValues) => void
  onCancel?: () => void
}) {
  const [values, setValues] = useState<ClientFormValues>(initial)

  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ ...values, name: values.name.trim() })
  }

  // O tratamento (Sr./Sra.) só faz sentido para pessoa física; instituição e
  // distribuidor são endereçados pelo nome da organização.
  const showPrefix = values.kind === 'INDIVIDUAL'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select value={values.kind} onChange={(e) => set('kind', e.target.value as ClientKind)}>
            {(Object.keys(CLIENT_KIND_LABEL) as ClientKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {CLIENT_KIND_LABEL[kind]}
              </option>
            ))}
          </Select>
        </Field>

        {showPrefix ? (
          <Field label="Tratamento">
            <Select value={values.prefix} onChange={(e) => set('prefix', e.target.value as ClientPrefix)}>
              <option value="NONE">Sem tratamento</option>
              <option value="MR">Sr. / Mr.</option>
              <option value="MS">Sra. / Ms.</option>
            </Select>
          </Field>
        ) : (
          <Field label="CNPJ / Tax ID">
            <Input value={values.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="Opcional" />
          </Field>
        )}

        <Field label="Nome" className="sm:col-span-2">
          <Input
            required
            autoFocus
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={values.kind === 'INDIVIDUAL' ? 'Dr. João Silva' : 'Hospital Sírio-Libanês'}
          />
        </Field>

        {values.kind === 'INDIVIDUAL' && (
          <Field label="Instituição" className="sm:col-span-2" hint="Onde essa pessoa trabalha, se aplicável.">
            <Input
              value={values.institution}
              onChange={(e) => set('institution', e.target.value)}
              placeholder="Opcional"
            />
          </Field>
        )}

        <Field label="E-mail">
          <Input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />
        </Field>

        <Field label="Telefone">
          <Input value={values.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>

        <Field label="País">
          <Input value={values.country} onChange={(e) => set('country', e.target.value)} placeholder="Brasil" />
        </Field>

        <Field label="Cidade / Estado">
          <div className="flex gap-2">
            <Input
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Cidade"
              className="min-w-0 flex-1"
            />
            <Input
              value={values.state}
              onChange={(e) => set('state', e.target.value)}
              placeholder="UF"
              className="w-20 shrink-0"
            />
          </div>
        </Field>

        {!compact && (
          <>
            {values.kind === 'INDIVIDUAL' && (
              <Field label="CPF / CNPJ / Tax ID">
                <Input value={values.taxId} onChange={(e) => set('taxId', e.target.value)} />
              </Field>
            )}

            <Field label="Site">
              <Input value={values.website} onChange={(e) => set('website', e.target.value)} />
            </Field>

            <Field
              label="Endereço de faturamento"
              className="sm:col-span-2"
              hint="Preenche automaticamente o Bill To do pedido."
            >
              <Textarea rows={3} value={values.billToText} onChange={(e) => set('billToText', e.target.value)} />
            </Field>

            <Field
              label="Endereço de entrega"
              className="sm:col-span-2"
              hint="Preenche automaticamente o Ship To do pedido."
            >
              <Textarea rows={3} value={values.shipToText} onChange={(e) => set('shipToText', e.target.value)} />
            </Field>

            <Field label="Observações" className="sm:col-span-2">
              <Textarea rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {error && <p className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-700">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isPending || !values.name.trim()}>
          {isPending ? 'Salvando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
