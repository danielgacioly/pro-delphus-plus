import axios from 'axios'

// Nomes de campo conhecidos, pro caso mais comum de erro (campo obrigatório
// vazio) virar uma frase que diz QUAL campo é, em vez do genérico "Dados
// inválidos" que o errorHandler do backend manda como título.
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  sku: 'SKU',
  sectors: 'Setores',
  email: 'E-mail',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  clientName: 'Cliente',
  clientId: 'Cliente',
  quoteId: 'Orçamento',
  items: 'Itens',
  productId: 'Produto',
  quantity: 'Quantidade',
  currency: 'Moeda',
  language: 'Idioma',
  exportScope: 'Tipo (Nacional/Internacional)',
  orderedByEmail: 'E-mail do comprador',
  billToText: 'Faturamento (Bill To)',
  shipToText: 'Entrega (Ship To)',
  password: 'Senha',
  newPassword: 'Nova senha',
  currentPassword: 'Senha atual',
  jobTitle: 'Cargo',
  taxId: 'CPF/CNPJ',
  institution: 'Instituição',
}

interface ZodIssueLike {
  path?: (string | number)[]
  code?: string
  origin?: string
  message?: string
}

function fieldLabelFor(issue: ZodIssueLike): string | null {
  const field = issue.path?.filter((p): p is string => typeof p === 'string').at(-1)
  if (!field) return null
  return FIELD_LABELS[field] ?? field
}

function describeIssue(issue: ZodIssueLike): string {
  const label = fieldLabelFor(issue)
  if (issue.code === 'too_small') {
    if (issue.origin === 'array') return label ? `Adicione pelo menos um item em "${label}".` : 'Adicione pelo menos um item.'
    return label ? `Preencha o campo "${label}".` : (issue.message ?? 'Campo obrigatório.')
  }
  if (issue.code === 'invalid_type' || issue.code === 'invalid_format' || issue.code === 'invalid_string') {
    return label ? `"${label}" está inválido.` : (issue.message ?? 'Dado inválido.')
  }
  return label ? `${label}: ${issue.message ?? 'inválido'}` : (issue.message ?? 'Dado inválido.')
}

/**
 * O errorHandler do backend manda `{ error: 'Dados inválidos', issues: [...] }`
 * pra qualquer falha de validação Zod — sem isto, toda tela mostrava só o
 * título genérico e ninguém sabia qual campo era o problema (ex: "Setores"
 * vazio virava só "Dados inválidos", sem dizer o quê).
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const data = (
    err as { response?: { data?: { error?: string; message?: string; issues?: ZodIssueLike[] } } }
  )?.response?.data
  if (data?.issues && data.issues.length > 0) return describeIssue(data.issues[0])
  return data?.error ?? data?.message ?? fallback
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Para chamadas que não passam pelo axios (streaming com `fetch`). */
export function getAccessToken() {
  return accessToken
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post<{ accessToken: string }>(
      '/api/auth/refresh',
      {},
      { withCredentials: true },
    )
    setAccessToken(data.accessToken)
    return data.accessToken
  } catch {
    setAccessToken(null)
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthRoute = typeof original?.url === 'string' && original.url.includes('/auth/')

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newToken = await refreshPromise
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
    }

    return Promise.reject(error)
  },
)
