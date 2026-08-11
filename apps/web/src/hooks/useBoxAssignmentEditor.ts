import { useState } from 'react'

export interface BoxLine {
  id: string
  label: string
  quantity: number
  box: number
}

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
    const count = Math.max(1, Number(value) || 1)
    setBoxLines((prev) => prev.map((l) => (l.box > count ? { ...l, box: count } : l)))
  }

  function updateBoxLine(id: string, patch: Partial<BoxLine>) {
    setBoxLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function splitBoxLine(id: string) {
    const index = boxLines.findIndex((l) => l.id === id)
    if (index === -1) return
    const line = boxLines[index]
    // Quantidade 1 não tem o que dividir — o botão já fica desabilitado nesse caso.
    if (line.quantity <= 1) return

    const half = Math.max(1, Math.floor(line.quantity / 2))
    const rest = line.quantity - half
    // Dividir só faz sentido se as duas partes forem para caixas diferentes —
    // senão é só duas linhas na mesma caixa, sem separar fisicamente nada. Se
    // a próxima caixa ainda não existir, ela é criada automaticamente.
    const currentCount = Math.max(1, Number(packageCount) || 1)
    const nextBox = line.box + 1
    if (nextBox > currentCount) {
      setPackageCount(String(nextBox))
    }
    const newLine: BoxLine = { id: `${id}-split-${Date.now()}`, label: line.label, quantity: half, box: nextBox }
    setBoxLines((prev) => {
      const i = prev.findIndex((l) => l.id === id)
      if (i === -1) return prev
      const next = [...prev]
      next[i] = { ...next[i], quantity: rest }
      next.splice(i + 1, 0, newLine)
      return next
    })
  }

  function addCustomBoxLine() {
    setBoxLines((prev) => [...prev, { id: `custom-${Date.now()}`, label: '', quantity: 1, box: 1 }])
  }

  function removeBoxLine(id: string) {
    setBoxLines((prev) => prev.filter((l) => l.id !== id))
  }

  const boxCount = Math.max(1, Number(packageCount) || 1)

  function buildPayload(): BoxAssignmentPayload {
    const count = boxCount
    const boxAssignments = boxLines.length
      ? Array.from({ length: count }, (_, boxIndex) =>
          boxLines
            .filter((l) => l.box === boxIndex + 1 && l.label.trim() && l.quantity > 0)
            .map((l) => ({ label: l.label.trim(), quantity: l.quantity })),
        )
      : undefined
    return {
      itemWeightsKg: itemWeights.some((w) => w) ? itemWeights.map((w) => (w ? Number(w) : null)) : undefined,
      packageCount: count,
      boxAssignments,
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
