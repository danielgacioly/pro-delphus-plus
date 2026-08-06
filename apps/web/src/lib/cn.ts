type ClassValue = string | false | null | undefined

/** Junta classes ignorando valores falsy. */
export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(' ')
}
