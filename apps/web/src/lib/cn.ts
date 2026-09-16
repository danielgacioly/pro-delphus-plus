import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type { ClassValue }

/** Junta classes ignorando valores falsy e resolvendo conflitos Tailwind (a última classe de uma mesma propriedade vence). */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values))
}
