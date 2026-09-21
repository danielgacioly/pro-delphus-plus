/**
 * O formato do formulário de cliente e as conversões entre ele e o DTO da API.
 *
 * Fora do componente porque um arquivo que exporta componente e não-componente
 * quebra o fast refresh do Vite: qualquer alteração recarrega a página inteira
 * em vez de só o componente.
 */
import type { ClientDTO, ClientKind, ClientPrefix } from '@prodelphusplus/shared'

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
  /** Marcação manual de acompanhamento comercial — independente de estar ativo/arquivado. */
  inService: boolean
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
  inService: false,
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
    inService: client.inService,
  }
}

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = {
  INDIVIDUAL: 'Pessoa',
  INSTITUTION: 'Instituição',
  DISTRIBUTOR: 'Distribuidor',
}
