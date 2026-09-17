import type { BoxAssignmentEditor } from '../hooks/useBoxAssignmentEditor'
import { Button, Field, Input, Select, Table, TBody, Td, THead, Th, Tr } from './ui'
import { IconPlus } from './icons'

interface ItemLike {
  productName: string
  quantity: number
  description?: string | null
}

/**
 * Bloco "Número de caixas" + "Itens por caixa" + "Peso por item" — usado tanto
 * na criação (NewOrder) quanto na edição (OrderDetail) de pedidos, para os
 * dois nunca divergirem sobre o comportamento de dividir/renomear/realocar.
 */
export function BoxAssignmentFields({ editor, items }: { editor: BoxAssignmentEditor; items: ItemLike[] }) {
  if (items.length === 0) return null

  // O Packing List é montado só a partir destas linhas, enquanto o Invoice sai
  // do orçamento — se as duas contas não baterem, o cliente recebe uma caixa
  // declarando menos (ou mais) do que a fatura cobra, e nada avisava. Linha sem
  // nome é descartada na hora de salvar, então também não conta como alocada.
  const expectedQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const namedLines = editor.boxLines.filter((l) => l.label.trim())
  const allocatedQty = namedLines.reduce((sum, l) => sum + (l.quantity || 0), 0)
  const unnamedCount = editor.boxLines.length - namedLines.length
  const mismatch = allocatedQty !== expectedQty

  return (
    <>
      <Field
        label="Número de caixas"
        hint='Preenche "Number of Packages" no invoice e gera uma página do Packing List Box por caixa.'
        className="mt-4 w-40"
      >
        <Input
          type="number"
          min={1}
          className="tabular"
          value={editor.packageCount}
          onChange={(e) => editor.updatePackageCount(e.target.value)}
        />
      </Field>

      <div className="mt-5 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <h3 className="text-eyebrow text-neutral-500">Itens por caixa</h3>
          <Button type="button" size="sm" onClick={editor.addCustomBoxLine}>
            <IconPlus className="h-3.5 w-3.5" />
            Item customizado
          </Button>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          Cada item vai para uma única caixa. Se um modelo completo precisar ser dividido entre caixas, use “dividir”
          para desmembrar a linha em partes que podem ser renomeadas e realocadas.
        </p>

        <div
          className={`mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-[12.5px] ${
            mismatch || unnamedCount > 0 ? 'bg-brand-50 text-brand-700' : 'bg-white text-neutral-500'
          }`}
        >
          <span className="tabular font-semibold">
            {allocatedQty} de {expectedQty} {expectedQty === 1 ? 'unidade alocada' : 'unidades alocadas'}
          </span>
          {mismatch && (
            <span>
              — o Packing List vai declarar {allocatedQty > expectedQty ? 'mais' : 'menos'} do que o orçamento cobra.
            </span>
          )}
          {unnamedCount > 0 && (
            <span>
              {mismatch ? ' ' : '— '}
              {unnamedCount === 1 ? '1 linha sem nome será descartada' : `${unnamedCount} linhas sem nome serão descartadas`}.
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200/70 bg-white">
          <Table>
            <THead>
              <Tr>
                <Th>Nome do item ou componente</Th>
                <Th align="center">Qtd.</Th>
                <Th>Caixa</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {editor.boxLines.map((line) => (
                <Tr key={line.id}>
                  <Td>
                    <Input
                      value={line.label}
                      placeholder="Nome do item ou componente"
                      onChange={(e) => editor.updateBoxLine(line.id, { label: e.target.value })}
                      className="h-9 min-w-48 text-[13px]"
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number"
                      min={1}
                      aria-label="Quantidade"
                      value={line.quantity}
                      onChange={(e) => editor.updateBoxLine(line.id, { quantity: Number(e.target.value) || 1 })}
                      className="tabular h-9 w-16 text-center text-[13px]"
                    />
                  </Td>
                  <Td>
                    <Select
                      auto
                      aria-label="Caixa"
                      value={line.box}
                      onChange={(e) => editor.updateBoxLine(line.id, { box: Number(e.target.value) })}
                      className="h-9 text-[13px]"
                    >
                      {Array.from({ length: editor.boxCount }, (_, i) => i + 1).map((b) => (
                        <option key={b} value={b}>
                          Caixa {b}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={line.quantity <= 1}
                        title={
                          line.quantity <= 1 ? 'Item de quantidade 1 não pode ser dividido' : 'Dividir em duas caixas'
                        }
                        onClick={() => editor.splitBoxLine(line.id)}
                      >
                        Dividir
                      </Button>
                      <button
                        type="button"
                        onClick={() => editor.removeBoxLine(line.id)}
                        aria-label="Remover linha"
                        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-brand-50 hover:text-brand-600 active:scale-90"
                      >
                        ×
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
        <h3 className="text-eyebrow mb-1.5 text-neutral-500">Peso por item</h3>
        <p className="mb-3 text-[12px] text-neutral-500">Em kg por unidade — usado no Documento de Exportação.</p>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-600">
                {item.productName}
                {item.description && <span className="text-neutral-400"> — {item.description}</span>}
              </span>
              <Input
                type="number"
                step="0.001"
                placeholder="kg/un."
                aria-label={`Peso de ${item.productName}`}
                value={editor.itemWeights[index] ?? ''}
                onChange={(e) => editor.updateItemWeight(index, e.target.value)}
                className="tabular h-9 w-28 shrink-0 text-[13px]"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
