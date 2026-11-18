export type CsvColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Quote when the value contains a delimiter, quote, or line break (RFC 4180).
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** RFC 4180 CSV with a BOM so Excel opens Myanmar/English text correctly. */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(','))
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`
}

function safeFileName(fileName: string): string {
  const trimmed = fileName.trim() || 'export'
  const withExtension = trimmed.toLowerCase().endsWith('.csv') ? trimmed : `${trimmed}.csv`
  return withExtension.replace(/[\\/:*?"<>|]+/g, '-')
}

export function downloadCsv<T>(fileName: string, columns: CsvColumn<T>[], rows: T[]): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeFileName(fileName)
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Uses the browser's print dialog; operational tables hide their toolbars in print. */
export function printPage(): void {
  if (typeof window !== 'undefined') window.print()
}

export function todayStamp(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
