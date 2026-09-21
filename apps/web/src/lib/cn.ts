import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// index.css defines .text-display/.text-title/.text-heading/.text-eyebrow as
// utilitários de tamanho de fonte. Sem isso, o validador isAny do tailwind-merge
// os classifica como `text-color` e os descarta em silêncio quando compostos
// com uma cor de texto.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': ['text-display', 'text-title', 'text-heading', 'text-eyebrow'] } },
})

export type { ClassValue }

/** Junta classes ignorando valores falsy e resolvendo conflitos Tailwind (a última classe de uma mesma propriedade vence). */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values))
}
