import type { BoxAssignmentEditor } from '../hooks/useBoxAssignmentEditor'
import { Button, Field, Input, Select } from './ui'
import { IconPlus } from './icons'

interface ItemLike {
  productName: string
  description?: string | null
}

/**
 * Bloco "Número de caixas" + "Itens por caixa" + "Peso por item" — usado tanto
 * na criação (NewOrder) quanto na edição (OrderDetail) de pedidos, para os
 * dois nunca divergirem sobre o comportamento de dividir/renomear/realocar.
 */
export function BoxAssignmentFields({ editor, items }: { editor: BoxAssignmentEditor; items: ItemLike[] }) {
  if (items.length === 0) return null

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

        <div className="space-y-2">
          {editor.boxLines.map((line) => (
            <div key={line.id} className="flex flex-wrap items-center gap-2">
              <Input
                value={line.label}
                placeholder="Nome do item ou componente"
                onChange={(e) => editor.updateBoxLine(line.id, { label: e.target.value })}
                className="h-9 min-w-48 flex-1 text-[13px]"
              />
              <Input
                type="number"
                min={1}
                aria-label="Quantidade"
                value={line.quantity}
                onChange={(e) => editor.updateBoxLine(line.id, { quantity: Number(e.target.value) || 1 })}
                className="tabular h-9 w-16 shrink-0 text-center text-[13px]"
              />
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
              <Button
                type="button"
                size="sm"
                disabled={line.quantity <= 1}
                title={line.quantity <= 1 ? 'Item de quantidade 1 não pode ser dividido' : 'Dividir em duas caixas'}
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
          ))}
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
