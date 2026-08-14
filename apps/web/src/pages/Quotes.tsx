import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientPrefixLabel, formatAmount, type QuoteDTO, type QuoteLanguage } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Page,
  SearchField,
  SegmentedControl,
  Select,
  SkeletonRows,
  TBody,
  THead,
  Table,
  TableShell,
  Td,
  Th,
  Toolbar,
  Tr,
} from '../components/ui'
import { IconPlus, IconQuote, IconTrash } from '../components/icons'

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

const languageLabel: Record<QuoteLanguage, string> = { PT: 'PT', EN: 'EN', ES: 'ES' }

const monthLabels = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const COLUMNS = 7

export function Quotes() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: quotes, isLoading, isError } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })
  const isAdmin = user?.role === 'ADMIN'

  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [deletingQuote, setDeletingQuote] = useState<QuoteDTO | null>(null)

  const deleteQuote = useMutation({
    mutationFn: async (quoteId: string) => api.delete(`/quotes/${quoteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setDeletingQuote(null)
      toast.success('Orçamento excluído.')
    },
  })

  const availableYears = useMemo(() => {
    const years = new Set((quotes ?? []).map((q) => new Date(q.createdAt).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [quotes])

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (quotes ?? []).filter((q) => {
      const date = new Date(q.createdAt)
      if (yearFilter !== 'all' && date.getFullYear() !== Number(yearFilter)) return false
      if (monthFilter !== 'all' && date.getMonth() !== Number(monthFilter)) return false
      if (scope === 'mine' && q.createdBy.id !== user?.id) return false
      if (term && !`${q.quoteNumber} ${q.clientName}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [quotes, yearFilter, monthFilter, scope, user?.id, search])

  return (
    <Page
      title="Orçamentos"
      description="Gere orçamentos automáticos em PDF ou Excel buscando por nome ou SKU."
      actions={
        <ButtonLink to="/orcamentos/novo" variant="primary" size="sm">
          <IconPlus className="h-4 w-4" />
          Novo orçamento
        </ButtonLink>
      }
    >
      <Toolbar className="mb-4">
        <SegmentedControl
          aria-label="Escopo"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'mine', label: 'Meus' },
          ]}
        />
        <Select
          aria-label="Ano"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          auto
          className="h-9 text-[13px]"
        >
          <option value="all">Todos os anos</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Mês"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          auto
          className="h-9 text-[13px]"
        >
          <option value="all">Todos os meses</option>
          {monthLabels.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </Select>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por número ou cliente"
          className="ml-auto w-full sm:w-72"
        />
      </Toolbar>

      <TableShell>
        <Table>
          <THead>
            <tr>
              <Th>Número</Th>
              <Th>Cliente</Th>
              <Th>Idioma</Th>
              <Th>Data</Th>
              <Th>Criado por</Th>
              <Th align="right">Total</Th>
              <Th align="right">Arquivos</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading && <SkeletonRows rows={6} columns={COLUMNS} />}

            {isError && (
              <tr>
                <td colSpan={COLUMNS} className="px-4 py-6 text-center text-sm text-brand-600">
                  Não foi possível carregar os orçamentos.
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              filteredQuotes.map((q) => {
                const prefix = clientPrefixLabel(q.clientPrefix, q.clientCountry, q.language)
                return (
                  <Tr key={q.id}>
                    <Td className="tabular whitespace-nowrap font-semibold text-ink-900">{q.quoteNumber}</Td>
                    <Td className="max-w-88">
                      <p className="truncate font-medium text-ink-900">
                        {prefix && `${prefix} `}
                        {q.clientName}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                        {q.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                      </p>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge>{languageLabel[q.language]}</Badge>
                        <span className="text-[12px] text-neutral-500">{q.currency}</span>
                        {q.priceTier === 'DISTRIBUTOR' && <Badge tone="ink">Distrib.</Badge>}
                      </span>
                    </Td>
                    <Td className="tabular whitespace-nowrap text-neutral-500">
                      {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                    </Td>
                    <Td className="whitespace-nowrap text-neutral-500">{q.createdBy.name}</Td>
                    <Td className="tabular whitespace-nowrap text-right font-semibold text-ink-900">
                      {formatAmount(q.total)}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1">
                        {q.pdfUrl && <FileLink href={q.pdfUrl}>PDF</FileLink>}
                        {q.xlsxUrl && <FileLink href={q.xlsxUrl}>Excel</FileLink>}
                        <Link
                          to={`/orcamentos/${q.id}/editar`}
                          title="Editar orçamento"
                          className="inline-flex h-7 items-center rounded-md border border-neutral-200 bg-white px-2 text-[12px] font-semibold text-neutral-600 shadow-xs transition-[background-color,border-color,color,transform] duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:text-ink-900 active:scale-95"
                        >
                          Editar
                        </Link>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Excluir orçamento"
                            aria-label="Excluir orçamento"
                            onClick={() => setDeletingQuote(q)}
                            className="text-neutral-500 hover:bg-brand-50 hover:text-brand-600"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </span>
                    </Td>
                  </Tr>
                )
              })}
          </TBody>
        </Table>

        {!isLoading && !isError && filteredQuotes.length === 0 && (
          <EmptyState
            icon={IconQuote}
            title="Nenhum orçamento encontrado"
            description="Ajuste os filtros ou crie um novo orçamento."
            action={
              <ButtonLink to="/orcamentos/novo" variant="secondary" size="sm">
                Novo orçamento
              </ButtonLink>
            }
          />
        )}
      </TableShell>

      {deletingQuote && (
        <ConfirmDeleteModal
          title={`Excluir orçamento ${deletingQuote.quoteNumber}?`}
          description="O orçamento e os arquivos PDF/Excel gerados serão removidos definitivamente."
          isPending={deleteQuote.isPending}
          error={
            deleteQuote.isError
              ? ((deleteQuote.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                'Não foi possível excluir este orçamento.')
              : null
          }
          onConfirm={() => deleteQuote.mutate(deletingQuote.id)}
          onCancel={() => {
            setDeletingQuote(null)
            deleteQuote.reset()
          }}
        />
      )}
    </Page>
  )
}

function FileLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-7 items-center rounded-md border border-neutral-200 bg-white px-2 text-[12px] font-semibold text-neutral-600 shadow-xs transition-[background-color,border-color,color,transform] duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:text-ink-900 active:scale-95"
    >
      {children}
    </a>
  )
}
