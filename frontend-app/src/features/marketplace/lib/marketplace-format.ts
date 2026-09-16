import type { CategoryRef } from '../types'

export function formatPrice(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} MMK`
}

export function categoryLabel(category: Pick<CategoryRef, 'name' | 'nameMy'> | null | undefined, language: string) {
  if (!category) return ''
  return language.startsWith('my') && category.nameMy ? category.nameMy : category.name
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}

/** ISO date (yyyy-mm-dd) for `<input type="date">`. */
export function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}
