import { useState } from 'react'
import {
  buildBoxAssignments,
  clampLinesToBoxes,
  effectiveBoxCount,
  parseBoxCount,
  splitLine,
  type BoxLine,
} from '../lib/boxAssignment'

export type { BoxLine }

interface ItemLike {
  productName: string
  quantity: number
}

export interface BoxAssignmentPayload {
  itemWeightsKg?: (number | null)[]
  packageCount: number
  boxAssignments?: { label: string; quantity: number }[][]
}

/**
 * Estado e regras de negócio da atribuição de itens em caixas — usado tanto
 * na criação (NewOrder) quanto na edição (OrderDetail) de pedidos, para os
 * dois nunca divergirem sobre como "dividir" ou renumerar caixas funciona.
 */
export function useBoxAssignmentEditor() {
  const [itemWeights, setItemWeights] = useState<string[]>([])
  const [packageCount, setPackageCount] = useState('1')
  const [boxLines, setBoxLines] = useState<BoxLine[]>([])

  // Um item por caixa (a caixa 1), como ponto de partida de um orçamento
  // recém-selecionado — nunca junta itens numa caixa sem o usuário decidir.
  function resetFromItems(items: ItemLike[] | undefined) {
    setItemWeights(items ? items.map(() => '') : [])
    setPackageCount('1')
    setBoxLines(
      items ? items.map((item, i) => ({ id: `item-${i}`, label: item.productName, quantity: item.quantity, box: 1 })) : [],
    )
  }

  // Carrega um pedido já existente (edição, ou duplicar um pedido anterior).
  function loadExisting(params: {
    items: ItemLike[]
    packageCount: number
    itemWeightsKg: (number | null)[] | null | undefined
    boxAssignments: { label: string; quantity: number }[][] | null | undefined
  }) {
    setPackageCount(String(params.packageCount || 1))
    setItemWeights(
      params.itemWeightsKg
        ? params.items.map((_, i) => {
            const w = params.itemWeightsKg?.[i]
            return w != null ? String(w) : ''
          })
        : params.items.map(() => ''),
    )
    if (params.boxAssignments) {
      const lines: BoxLine[] = []
      params.boxAssignments.forEach((box, boxIndex) => {
        box.forEach((entry, i) => {
          lines.push({ id: `existing-${boxIndex}-${i}`, label: entry.label, quantity: entry.quantity, box: boxIndex + 1 })
        })
      })
      setBoxLines(lines)
    } else {
      setBoxLines(
        params.items.map((item, i) => ({ id: `item-${i}`, label: item.productName, quantity: item.quantity, box: 1 })),
      )
    }
  }

  function updateItemWeight(index: number, value: string) {
    setItemWeights((prev) => prev.map((w, i) => (i === index ? value : w)))
  }

  function updatePackageCount(value: string) {
    setPackageCount(value)
    // Só redistribui quando o texto é mesmo um número de caixas. O campo fica
    // vazio por um instante sempre que alguém apaga para digitar outro número,
    // e tratar esse vazio como "1 caixa" jogava a divisão inteira na caixa 1 —
    // sem volta, porque digitar o número novo não desfaz.
    const count = parseBoxCount(value)
    if (count === null) return
    setBoxLines((prev) => clampLinesToBoxes(prev, count))
  }

  function updateBoxLine(id: string, patch: Partial<BoxLine>) {
    setBoxLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function splitBoxLine(id: string) {
    const result = splitLine(boxLines, id, boxCount)
    if (!result) return
    setBoxLines(result.lines)
    if (result.boxCount !== boxCount) setPackageCount(String(result.boxCount))
  }

  function addCustomBoxLine() {
    setBoxLines((prev) => [...prev, { id: `custom-${Date.now()}`, label: '', quantity: 1, box: 1 }])
  }

  function removeBoxLine(id: string) {
    setBoxLines((prev) => prev.filter((l) => l.id !== id))
  }

  const boxCount = effectiveBoxCount(boxLines, packageCount)

  function buildPayload(): BoxAssignmentPayload {
    return {
      itemWeightsKg: itemWeights.some((w) => w) ? itemWeights.map((w) => (w ? Number(w) : null)) : undefined,
      packageCount: boxCount,
      boxAssignments: buildBoxAssignments(boxLines, boxCount),
    }
  }

  return {
    itemWeights,
    packageCount,
    boxLines,
    boxCount,
    resetFromItems,
    loadExisting,
    updateItemWeight,
    updatePackageCount,
    updateBoxLine,
    splitBoxLine,
    addCustomBoxLine,
    removeBoxLine,
    buildPayload,
  }
}

export type BoxAssignmentEditor = ReturnType<typeof useBoxAssignmentEditor>
