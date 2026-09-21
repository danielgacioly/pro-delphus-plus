/**
 * As regras de como itens de um pedido se distribuem entre caixas, separadas
 * do estado de React para poderem ser testadas sozinhas.
 *
 * O componente guarda o número de caixas como o texto que está no campo, e não
 * como número: é o que permite o campo ficar vazio enquanto alguém troca "2"
 * por "12" sem que o sistema interprete esse vazio como uma decisão.
 */

/** Uma linha do editor: um rótulo, uma quantidade e a caixa onde ela vai. */
export interface BoxLine {
  id: string
  label: string
  quantity: number
  box: number
}

/**
 * O número de caixas que o texto do campo representa.
 *
 * @returns `null` quando o texto não é um número de caixas utilizável — campo
 * vazio, zero, negativo ou fracionado. Distinguir isso de "1" é o que impede o
 * vazio momentâneo de valer como decisão.
 */
export function parseBoxCount(raw: string): number | null {
  if (raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return null
  return value
}

/**
 * Traz para a última caixa as linhas que ficaram além do total.
 *
 * Só faz sentido quando alguém reduz o número de caixas de propósito: item em
 * caixa que não existe mais some do Packing List.
 */
export function clampLinesToBoxes(lines: BoxLine[], count: number): BoxLine[] {
  return lines.map((line) => (line.box > count ? { ...line, box: count } : line))
}

/** A caixa de número mais alto que alguma linha ocupa (1 quando não há linha). */
export function highestUsedBox(lines: BoxLine[]): number {
  return lines.reduce((max, line) => Math.max(max, line.box), 1)
}

/**
 * Quantas caixas o pedido declara de fato.
 *
 * Nunca menos que a caixa mais alta em uso: com o campo vazio ou menor que a
 * distribuição, montar o payload pelo número do campo apagaria do Packing List
 * todo item que estivesse acima dele, sem aviso nenhum.
 */
export function effectiveBoxCount(lines: BoxLine[], raw: string): number {
  return Math.max(parseBoxCount(raw) ?? 1, highestUsedBox(lines))
}

/**
 * A divisão em caixas no formato que a API espera: uma lista por caixa, na
 * ordem das caixas, sem as linhas em branco ou zeradas que o editor permite
 * enquanto alguém digita.
 */
export function buildBoxAssignments(
  lines: BoxLine[],
  count: number,
): { label: string; quantity: number }[][] | undefined {
  if (lines.length === 0) return undefined
  return Array.from({ length: count }, (_, boxIndex) =>
    lines
      .filter((line) => line.box === boxIndex + 1 && line.label.trim() && line.quantity > 0)
      .map((line) => ({ label: line.label.trim(), quantity: line.quantity })),
  )
}

/**
 * Divide uma linha em duas, mandando metade para a caixa seguinte.
 *
 * Dividir só faz sentido se as duas partes forem para caixas diferentes —
 * senão são duas linhas na mesma caixa, sem separar fisicamente nada. Se a
 * caixa seguinte ainda não existir, ela passa a existir.
 *
 * @returns as linhas novas e quantas caixas o pedido precisa ter, ou `null`
 * quando não há o que dividir.
 */
export function splitLine(
  lines: BoxLine[],
  id: string,
  boxCount: number,
): { lines: BoxLine[]; boxCount: number } | null {
  const index = lines.findIndex((line) => line.id === id)
  if (index === -1) return null
  const line = lines[index]!
  // Quantidade 1 não tem o que dividir — o botão fica desabilitado nesse caso.
  if (line.quantity <= 1) return null

  const half = Math.max(1, Math.floor(line.quantity / 2))
  const nextBox = line.box + 1
  const next = [...lines]
  next[index] = { ...line, quantity: line.quantity - half }
  next.splice(index + 1, 0, {
    id: `${id}-split-${Date.now()}`,
    label: line.label,
    quantity: half,
    box: nextBox,
  })
  return { lines: next, boxCount: Math.max(boxCount, nextBox) }
}
