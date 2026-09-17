import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// index.css defines .text-display/.text-title/.text-heading/.text-eyebrow as
// font-size utilities; without this, tailwind-merge's isAny validator files them
// under `text-color` and silently drops them when composed with a text color.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': ['text-display', 'text-title', 'text-heading', 'text-eyebrow'] } },
})

export type { ClassValue }

/** Junta classes ignorando valores falsy e resolvendo conflitos Tailwind (a última classe de uma mesma propriedade vence). */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values))
}
