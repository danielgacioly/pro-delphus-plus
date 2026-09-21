/**
 * A janela de tempo usada para comparar "este mês" com "o mês passado" nos
 * números da Home.
 */

/** Um recorte de tempo, fechado no início e aberto no fim. */
export interface MonthWindow {
  /** Primeiro instante do mês corrente. */
  start: number
  /** Primeiro instante do mês anterior. */
  previousStart: number
  /** Fim (exclusivo) do recorte comparável do mês anterior. */
  previousEnd: number
}

/**
 * Mês corrido contra o MESMO trecho do mês passado: comparar cinco dias com
 * trinta faria todo dia 2 acusar uma queda de 90% que não existe.
 *
 * O teto é o início do mês corrente. Sem ele, um mês anterior mais curto deixa
 * a janela invadir o atual — em 30 de março ela ia até 2 de março — e os
 * registros de hoje entravam também na base de comparação, contra a qual estão
 * sendo comparados.
 */
export function monthWindow(now: Date): MonthWindow {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const elapsed = now.getTime() - start
  return { start, previousStart, previousEnd: Math.min(previousStart + elapsed, start) }
}

/** Se a data cai no mês corrente. */
export function isInCurrentMonth(window: MonthWindow, iso: string): boolean {
  return new Date(iso).getTime() >= window.start
}

/** Se a data cai no trecho comparável do mês anterior. */
export function isInPreviousWindow(window: MonthWindow, iso: string): boolean {
  const time = new Date(iso).getTime()
  return time >= window.previousStart && time < window.previousEnd
}

/**
 * Variação percentual contra a base.
 *
 * @returns `null` quando não havia base — sem registro no mês anterior não
 * existe porcentagem honesta, e mostrar "+100%" ou "—" em cada coluna vira
 * ruído. A linha simplesmente não aparece.
 */
export function variation(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
