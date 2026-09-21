/**
 * Escape de HTML para os documentos gerados.
 *
 * Os três geradores de PDF montam HTML com dado vindo do banco (nome de
 * cliente, descrição de produto, observação digitada). Escapar isso estava
 * escrito três vezes, o que significa que endurecer um deles não alcançava os
 * outros dois.
 */

/** Texto seguro para ir dentro de um elemento ou de um atributo entre aspas. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Como `escapeHtml`, mas preservando as quebras de linha que a pessoa digitou. */
export function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />')
}
