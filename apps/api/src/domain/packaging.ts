/**
 * Como os itens de um pedido se dividem em caixas e como isso vira página de
 * Packing List Box. Sem banco e sem HTTP, pelos mesmos motivos de
 * `domain/pricing.ts`.
 */
import type { BoxAssignments } from '@prodelphusplus/shared'

/** Uma linha impressa dentro de uma caixa. */
export interface PackingListBoxItem {
  title: string
  quantity: number
}

/** Uma página do Packing List Box: uma caixa e o que vai dentro dela. */
export interface PackingListBoxPage {
  boxNumber: number
  totalBoxes: number
  items: PackingListBoxItem[]
}

/**
 * "01 Carton" / "02 Cartons" — o campo "Number of Packages" do Invoice e do
 * Packing List sempre sai daqui, nunca digitado, para não poder divergir de
 * quantas páginas de Packing List Box existem.
 */
export function formatPackageCountLabel(count: number): string {
  return `${String(count).padStart(2, '0')} ${count === 1 ? 'Carton' : 'Cartons'}`
}

/**
 * Cada caixa declarada na divisão precisa existir de fato no pedido. Com mais
 * listas de itens do que caixas, `buildBoxPages` descartava as sobrando em
 * silêncio e o Packing List saía com menos itens do que o Invoice cobra.
 */
export function boxAssignmentsFit(
  boxAssignments: BoxAssignments | null | undefined,
  packageCount: number,
): boolean {
  return !boxAssignments || boxAssignments.length <= packageCount
}

/**
 * Uma página por caixa declarada. Sem divisão explícita, tudo vai na caixa 1 e
 * as demais saem vazias — em vez de chutar uma repartição que ninguém pediu.
 */
export function buildBoxPages(
  packageCount: number,
  boxAssignments: BoxAssignments | null,
  docItems: { title: string; quantity: number }[],
): PackingListBoxPage[] {
  if (!boxAssignments || boxAssignments.length === 0) {
    return Array.from({ length: packageCount }, (_, i) => ({
      boxNumber: i + 1,
      totalBoxes: packageCount,
      items: i === 0 ? docItems.map((it) => ({ title: it.title, quantity: it.quantity })) : [],
    }))
  }
  return Array.from({ length: packageCount }, (_, i) => ({
    boxNumber: i + 1,
    totalBoxes: packageCount,
    items: (boxAssignments[i] ?? []).map((entry) => ({ title: entry.label, quantity: entry.quantity })),
  }))
}
