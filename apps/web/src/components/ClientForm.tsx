import { useState, type FormEvent } from 'react'
import type { ClientKind, ClientPrefix } from '@prodelphusplus/shared'
import { Alert, Button, Field, Input, Select, Textarea } from './ui'
import { CLIENT_KIND_LABEL, emptyClientForm, type ClientFormValues } from './clientForm.model'

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

        <Field label="Status" className="sm:col-span-2">
          <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-lg py-1 text-[13px] text-ink-700">
            <input
              type="checkbox"
              checked={values.inService}
              onChange={(e) => set('inService', e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-600"
            />
            Em atendimento
          </label>
        </Field>

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
              placeholder="Estado"
              className="w-32 shrink-0"
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
              hint="Para sua referência no preenchimento do Bill To do pedido."
            >
              <Textarea rows={3} value={values.billToText} onChange={(e) => set('billToText', e.target.value)} />
            </Field>

            <Field
              label="Endereço de entrega"
              className="sm:col-span-2"
              hint="Para sua referência no preenchimento do Ship To do pedido."
            >
              <Textarea rows={3} value={values.shipToText} onChange={(e) => set('shipToText', e.target.value)} />
            </Field>

            <Field label="Observações" className="sm:col-span-2">
              <Textarea rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

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
