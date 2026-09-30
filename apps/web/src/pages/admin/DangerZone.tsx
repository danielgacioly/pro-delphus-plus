import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adjustedPrice,
  findPriceTable,
  PRICE_ADJUSTMENT_MAX_PERCENT,
  PRICE_ADJUSTMENT_MIN_PERCENT,
  PRICE_TABLES,
  type PriceAdjustmentDTO,
  type PriceTableKey,
  type SectorDTO,
} from '@prodelphusplus/shared'
import { api, getErrorMessage } from '../../lib/api'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import { IconTrash } from '../../components/icons'
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui'

function money(currency: string, value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}

function formatPercent(percent: number) {
  return `${percent > 0 ? '+' : ''}${percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/**
 * Ações que mexem no sistema inteiro de uma vez e não têm volta. Cada uma
 * pede confirmação digitada, e o reajuste mostra antes quantos produtos e
 * quanto muda.
 */
export function DangerZone() {
  return (
    <Card className="border-danger-500/30 p-6">
      <h2 className="text-heading text-danger-600">Zona de perigo</h2>
      <p className="mt-1 text-[13px] text-neutral-600">
        Ações permanentes, que valem pro sistema inteiro. Confira antes de confirmar.
      </p>
      <div className="mt-6 space-y-8">
        <PriceAdjustment />
        <div className="border-t border-black/[0.07]" />
        <SectorDeletion />
      </div>
    </Card>
  )
}

function PriceAdjustment() {
  const queryClient = useQueryClient()
  const [priceTable, setPriceTable] = useState<PriceTableKey>(PRICE_TABLES[0].key)
  const [percentInput, setPercentInput] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const table = findPriceTable(priceTable)!
  const percent = Number(percentInput.replace(',', '.'))
  const percentValid =
    percentInput.trim() !== '' &&
    Number.isFinite(percent) &&
    percent !== 0 &&
    percent >= PRICE_ADJUSTMENT_MIN_PERCENT &&
    percent <= PRICE_ADJUSTMENT_MAX_PERCENT

  const preview = useQuery({
    queryKey: ['price-adjustment-preview', priceTable],
    queryFn: async () => {
      const { data } = await api.get<{ productCount: number; samples: { name: string; sku: string; price: number }[] }>(
        '/admin/price-adjustments/preview',
        { params: { priceTable } },
      )
      return data
    },
  })

  const history = useQuery({
    queryKey: ['price-adjustments'],
    queryFn: async () => {
      const { data } = await api.get<{ adjustments: PriceAdjustmentDTO[] }>('/admin/price-adjustments')
      return data.adjustments
    },
  })

  const apply = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ adjustment: PriceAdjustmentDTO }>('/admin/price-adjustments', {
        priceTable,
        percent,
      })
      return data.adjustment
    },
    onSuccess: (adjustment) => {
      setConfirming(false)
      setError(null)
      setPercentInput('')
      setDone(
        `Reajuste de ${formatPercent(adjustment.percent)} aplicado à tabela ${table.label} — ${adjustment.productCount} produto(s) atualizado(s).`,
      )
      // Preço mudou em todo lugar que mostra catálogo.
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-price-table'] })
      queryClient.invalidateQueries({ queryKey: ['price-adjustment-preview'] })
      queryClient.invalidateQueries({ queryKey: ['price-adjustments'] })
    },
    onError: (err: unknown) => setError(getErrorMessage(err, 'Não foi possível aplicar o reajuste.')),
  })

  return (
    <section>
      <h3 className="text-[14px] font-semibold text-ink-900">Reajuste de preços</h3>
      <p className="mt-0.5 text-[12.5px] text-neutral-600">
        Aplica uma porcentagem a todos os preços de uma tabela, de forma permanente. Orçamentos e pedidos já gerados não
        mudam.
      </p>

      {done && (
        <div className="mt-3">
          <Alert tone="success">{done}</Alert>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[220px_160px_max-content] sm:items-end">
        <Field label="Tabela de preço">
          <Select
            value={priceTable}
            onChange={(e) => {
              setPriceTable(e.target.value as PriceTableKey)
              setDone(null)
            }}
          >
            {PRICE_TABLES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reajuste (%)">
          <Input
            inputMode="decimal"
            placeholder="ex: 10 ou -5"
            className="tabular"
            value={percentInput}
            onChange={(e) => {
              setPercentInput(e.target.value)
              setDone(null)
            }}
          />
        </Field>
        <Button
          variant="danger"
          size="md"
          disabled={!percentValid || !preview.data?.productCount}
          onClick={() => {
            setError(null)
            setConfirming(true)
          }}
        >
          Aplicar reajuste
        </Button>
      </div>

      {percentInput.trim() !== '' && !percentValid && (
        <p className="mt-2 text-[12.5px] text-danger-600">
          Use um valor diferente de zero, entre {PRICE_ADJUSTMENT_MIN_PERCENT}% e +{PRICE_ADJUSTMENT_MAX_PERCENT}%.
        </p>
      )}

      {preview.data && (
        <div className="mt-4 rounded-xl bg-neutral-500/6 px-4 py-3 text-[12.5px] text-neutral-700">
          <p>
            <strong className="font-semibold text-ink-900">{preview.data.productCount}</strong> produto(s) têm preço na
            tabela {table.label}
            {percentValid ? ` — todos passam a valer ${formatPercent(percent)}.` : '.'}
          </p>
          {percentValid && preview.data.samples.length > 0 && (
            <p className="mt-1.5 text-neutral-500">
              Exemplos ({preview.data.samples.length} de {preview.data.productCount}, em ordem alfabética):
            </p>
          )}
          {percentValid && preview.data.samples.length > 0 && (
            <ul className="mt-0.5 space-y-0.5 tabular">
              {preview.data.samples.map((s) => (
                <li key={s.sku + s.name}>
                  {s.name}: {money(table.currency, s.price)} → {money(table.currency, adjustedPrice(s.price, percent))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {history.data && history.data.length > 0 && (
        <div className="mt-5">
          <p className="text-[12px] font-medium text-neutral-600">Últimos reajustes</p>
          <ul className="mt-1.5 divide-y divide-black/[0.06] text-[12.5px]">
            {history.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
                <span className="text-ink-900">
                  <span className="font-medium tabular">{formatPercent(a.percent)}</span> em{' '}
                  {findPriceTable(a.priceTable)?.label ?? a.priceTable} · {a.productCount} produto(s)
                </span>
                <span className="text-neutral-500">
                  {new Date(a.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {a.createdByName && ` · ${a.createdByName}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirming && preview.data && (
        <ConfirmDeleteModal
          title={`Reajustar ${formatPercent(percent)} a tabela ${table.label}?`}
          description={`Os preços de ${preview.data.productCount} produto(s) na tabela ${table.label} mudam permanentemente. Para voltar, só com outro reajuste.`}
          confirmWord="reajustar"
          confirmLabel="Reajustar preços"
          isPending={apply.isPending}
          error={error}
          onCancel={() => setConfirming(false)}
          onConfirm={() => apply.mutate()}
        />
      )}
    </section>
  )
}

function SectorDeletion() {
  const queryClient = useQueryClient()
  const [sectorId, setSectorId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const { data: sectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      const { data } = await api.get<{ sectors: SectorDTO[] }>('/sectors')
      return data.sectors
    },
  })
  const sector = sectors?.find((s) => s.id === sectorId)

  const deleteSector = useMutation({
    mutationFn: async (id: string) => api.delete(`/sectors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] })
      queryClient.invalidateQueries({ queryKey: ['product-sectors'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-price-table'] })
      setDone(`Setor "${sector?.name}" excluído.`)
      setSectorId('')
      setConfirming(false)
      setError(null)
    },
    onError: (err: unknown) => setError(getErrorMessage(err, 'Não foi possível excluir o setor.')),
  })

  return (
    <section>
      <h3 className="text-[14px] font-semibold text-ink-900">Excluir setor</h3>
      <p className="mt-0.5 text-[12.5px] text-neutral-600">
        Só dá pra excluir setor sem produto vinculado. Criar e renomear continuam na página Setores.
      </p>

      {done && (
        <div className="mt-3">
          <Alert tone="success">{done}</Alert>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[396px_max-content] sm:items-end">
        <Field label="Setor">
          <Select
            value={sectorId}
            onChange={(e) => {
              setSectorId(e.target.value)
              setDone(null)
            }}
          >
            <option value="">Selecione um setor…</option>
            {sectors?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.namePt ? ` · ${s.namePt}` : ''} ({s.productCount} produto{s.productCount === 1 ? '' : 's'})
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="danger"
          size="md"
          disabled={!sector}
          onClick={() => {
            setError(null)
            setConfirming(true)
          }}
        >
          <IconTrash className="h-3.5 w-3.5" />
          Excluir setor
        </Button>
      </div>

      {sector && sector.productCount > 0 && (
        <p className="mt-2 text-[12.5px] text-danger-600">
          Este setor tem {sector.productCount} produto(s) vinculado(s) — mova ou exclua esses produtos antes.
        </p>
      )}

      {confirming && sector && (
        <ConfirmDeleteModal
          title={`Excluir "${sector.name}"?`}
          description={
            sector.productCount > 0
              ? `Este setor tem ${sector.productCount} produto(s) vinculado(s). Mova ou exclua esses produtos antes de remover o setor.`
              : 'O setor some do catálogo e da tabela de preços. Essa ação não pode ser desfeita.'
          }
          isPending={deleteSector.isPending}
          error={error}
          onCancel={() => setConfirming(false)}
          onConfirm={() => deleteSector.mutate(sector.id)}
        />
      )}
    </section>
  )
}
