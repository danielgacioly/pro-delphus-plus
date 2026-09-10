/**
 * Espera curta e aleatória entre tentativas de reservar um número.
 *
 * Sem isso, requisições simultâneas leem a mesma contagem, colidem, e voltam
 * todas juntas para colidir de novo na tentativa seguinte — um lote de 12
 * criações ao mesmo tempo perdia metade com "tente novamente", mesmo havendo
 * número livre de sobra. O atraso escalonado desmancha o bolo: cada uma volta
 * num instante diferente e pega o próximo número livre.
 */
export function reservationBackoff(attempt: number) {
  const base = 25 * 2 ** attempt
  return new Promise<void>((resolve) => setTimeout(resolve, base + Math.random() * base))
}
