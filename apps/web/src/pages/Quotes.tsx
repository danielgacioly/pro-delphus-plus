import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatAmount, type ClientPrefix, type QuoteDTO, type QuoteLanguage } from '@prodelphusplus/shared'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { EmptyState } from '../components/EmptyState'
import { Badge } from '../components/Badge'
import { IconQuote } from '../components/icons'

async function fetchQuotes() {
  const { data } = await api.get<{ quotes: QuoteDTO[] }>('/quotes')
  return data.quotes
}

const prefixLabelsByLanguage: Record<QuoteLanguage, Record<ClientPrefix, string>> = {
  PT: { NONE: '—', MR: 'Sr.', MS: 'Sra.' },
  EN: { NONE: '—', MR: 'Mr.', MS: 'Ms.' },
  ES: { NONE: '—', MR: 'Sr.', MS: 'Sra.' },
}

const languageLabel: Record<QuoteLanguage, string> = {
  PT: 'Português',
  EN: 'English',
  ES: 'Español',
}

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

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i}>
          {Array.from({ length: 9 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="skeleton h-3 w-full max-w-20 rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function Quotes() {
  const { user } = useAuth()
  const { data: quotes, isLoading } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes })

  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)

  const availableYears = useMemo(() => {
    const years = new Set((quotes ?? []).map((q) => new Date(q.createdAt).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [quotes])

  const filteredQuotes = useMemo(() => {
    return (quotes ?? []).filter((q) => {
      const date = new Date(q.createdAt)
      if (yearFilter !== 'all' && date.getFullYear() !== Number(yearFilter)) return false
      if (monthFilter !== 'all' && date.getMonth() !== Number(monthFilter)) return false
      if (onlyMine && q.createdBy.id !== user?.id) return false
      return true
    })
  }, [quotes, yearFilter, monthFilter, onlyMine, user?.id])

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Orçamentos</h1>
          <p className="mt-1 text-neutral-500">Gere orçamentos automáticos em PDF ou Excel buscando por nome ou SKU.</p>
        </div>
        <Link
          to="/orcamentos/novo"
          className="mt-7 shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
        >
          + Novo orçamento
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:border-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">Todos os anos</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:border-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">Todos os meses</option>
          {monthLabels.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyMine((s) => !s)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            onlyMine
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
          }`}
        >
          Meus orçamentos
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Número</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Cliente</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Idioma</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Moeda</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Data</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Criado por</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Itens</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Total</th>
                <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Arquivos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading && <SkeletonRows />}
              {!isLoading &&
                filteredQuotes.map((q, index) => (
                  <tr
                    key={q.id}
                    className="animate-fade-in-up transition-colors hover:bg-neutral-50"
                    style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink-900">{q.quoteNumber}</td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {q.clientPrefix !== 'NONE' && `${prefixLabelsByLanguage[q.language][q.clientPrefix]} `}
                      {q.clientName}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{languageLabel[q.language]}</td>
                    <td className="px-4 py-2.5 text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        {q.currency}
                        {q.priceTier === 'DISTRIBUTOR' && <Badge>Distribuidor</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{new Date(q.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{q.createdBy.name}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-neutral-600">
                      {q.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink-900">{formatAmount(q.total)}</td>
                    <td className="space-x-3 px-4 py-2.5 text-right">
                      {q.pdfUrl && (
                        <a
                          href={q.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-brand-600 hover:underline"
                        >
                          PDF
                        </a>
                      )}
                      {q.xlsxUrl && (
                        <a
                          href={q.xlsxUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-brand-600 hover:underline"
                        >
                          Excel
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredQuotes.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={IconQuote}
              title="Nenhum orçamento encontrado"
              description="Ajuste os filtros ou crie um novo orçamento."
            />
          </div>
        )}
      </div>
    </div>
  )
}
