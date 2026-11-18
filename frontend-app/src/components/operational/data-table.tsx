import { ArrowDown, ArrowUp, ArrowUpDown, Download, Printer, Rows3, Rows4 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  downloadCsv,
  printPage,
  todayStamp,
  type CsvColumn,
} from '@/components/operational/export'

export type SortDirection = 'asc' | 'desc'

export type DataTableColumn<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Enables sorting. Without it the column is display-only. */
  sortValue?: (row: T) => string | number | Date | null | undefined
  align?: 'left' | 'right' | 'center'
  /** Hidden in the stacked phone/tablet card view. */
  hideOnMobile?: boolean
  /** Actions usually deserve their own full-width row in the card view. */
  mobileFullWidth?: boolean
  headerClassName?: string
  cellClassName?: string
}

export type DataTableCsv<T> = {
  fileName: string
  columns: CsvColumn<T>[]
}

type DataTableProps<T> = {
  rows: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => string
  caption: string
  isLoading?: boolean
  loadingRows?: number
  emptyMessage: ReactNode
  /** Optional node rendered above the table (for example a total or saved-view hint). */
  toolbar?: ReactNode
  footer?: ReactNode
  selectable?: boolean
  rowLabel?: (row: T) => string
  csv?: DataTableCsv<T>
  printable?: boolean
  className?: string
  sortParam?: string
  directionParam?: string
  densityParam?: string
}

function compareValues(a: string | number | Date | null | undefined, b: string | number | Date | null | undefined): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (a instanceof Date || b instanceof Date) {
    return new Date(a).getTime() - new Date(b).getTime()
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function useIsCompactViewport(): boolean {
  const query = '(max-width: 767px)'
  const read = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  const [isCompact, setIsCompact] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    setIsCompact(media.matches)
    const onChange = (event: MediaQueryListEvent) => setIsCompact(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isCompact
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  )
}

/**
 * Shared operational table: sticky header, URL-backed sort and density, skeleton rows,
 * an in-table empty state, optional CSV/print actions, and a card view for phones/tablets.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  isLoading = false,
  loadingRows = 5,
  emptyMessage,
  toolbar,
  footer,
  selectable = false,
  rowLabel,
  csv,
  printable = true,
  className,
  sortParam = 'sort',
  directionParam = 'dir',
  densityParam = 'density',
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const isCompact = useIsCompactViewport()

  const density = searchParams.get(densityParam) === 'compact' ? 'compact' : 'comfortable'
  const sortKey = searchParams.get(sortParam)
  const rawDirection = searchParams.get(directionParam)
  const sortDirection: SortDirection = rawDirection === 'desc' ? 'desc' : 'asc'
  const activeColumn = columns.find((column) => column.key === sortKey && column.sortValue)

  const visibleRows = useMemo(() => {
    if (!activeColumn?.sortValue) return rows
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => compareValues(activeColumn.sortValue!(left), activeColumn.sortValue!(right)) * direction)
  }, [rows, activeColumn, sortDirection])

  const allKeys = visibleRows.map(rowKey)
  const allKeySignature = allKeys.join('|')

  useEffect(() => {
    setSelected((current) => {
      const kept = new Set([...current].filter((key) => allKeys.includes(key)))
      return kept.size === current.size ? current : kept
    })
    // Rows change identity when a filter, page, or refresh changes the result set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeySignature])

  const selectedRows = visibleRows.filter((row) => selected.has(rowKey(row)))
  const allSelected = visibleRows.length > 0 && selectedRows.length === visibleRows.length
  const someSelected = selectedRows.length > 0 && !allSelected

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  const updateParam = (key: string, value: string | null) => {
    updateParams((next) => {
      if (value === null) next.delete(key)
      else next.set(key, value)
    })
  }

  const cycleSort = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return
    if (sortKey !== column.key) {
      updateParams((next) => {
        next.set(sortParam, column.key)
        next.set(directionParam, 'asc')
      })
      return
    }
    if (sortDirection === 'asc') {
      updateParam(directionParam, 'desc')
      return
    }
    updateParams((next) => {
      next.delete(sortParam)
      next.delete(directionParam)
    })
  }

  const toggleRow = (key: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(allKeys) : new Set())
  }

  const exportRows = selectedRows.length > 0 ? selectedRows : visibleRows
  const exportLabel = selectedRows.length > 0
    ? t('ops.export.selected', { count: selectedRows.length })
    : t('ops.export.csv')
  const fileName = csv ? `${csv.fileName}-${todayStamp()}` : ''

  const padding = density === 'compact' ? 'px-2 py-1.5' : 'px-3 py-3'

  const selectionCell = (row: T) =>
    selectable ? (
      <input
        type="checkbox"
        checked={selected.has(rowKey(row))}
        aria-label={t('ops.table.selectRow', { name: rowLabel?.(row) ?? rowKey(row) })}
        onChange={() => toggleRow(rowKey(row))}
        className="size-4 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    ) : null

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-card print:border-0 print:shadow-none', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {selectable && selectedRows.length > 0 ? (
            <span className="text-sm text-muted-foreground" role="status">
              {t('ops.table.selected', { count: selectedRows.length })}
            </span>
          ) : null}
          {toolbar}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {csv ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => downloadCsv(fileName, csv.columns, exportRows)}>
              <Download className="size-4" aria-hidden />
              {exportLabel}
            </Button>
          ) : null}
          {printable ? (
            <Button type="button" size="sm" variant="ghost" onClick={printPage}>
              <Printer className="size-4" aria-hidden />
              {t('ops.export.print')}
            </Button>
          ) : null}
          <div className="ml-1 flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label={t('ops.table.density')}>
            <Button
              type="button"
              size="sm"
              variant={density === 'comfortable' ? 'secondary' : 'ghost'}
              aria-pressed={density === 'comfortable'}
              aria-label={t('ops.table.comfortable')}
              title={t('ops.table.comfortable')}
              onClick={() => updateParam(densityParam, null)}
            >
              <Rows3 className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={density === 'compact' ? 'secondary' : 'ghost'}
              aria-pressed={density === 'compact'}
              aria-label={t('ops.table.compact')}
              title={t('ops.table.compact')}
              onClick={() => updateParam(densityParam, 'compact')}
            >
              <Rows4 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {/* Phone and tablet: the same rows as labelled cards, never a sideways-scrolling table. */}
      {isCompact ? (
        <div className="space-y-3 p-3 md:hidden print:hidden">
          {isLoading ? (
            Array.from({ length: loadingRows }, (_, index) => (
              <div key={`mobile-skeleton-${index}`} className="space-y-2 rounded-lg border p-3" aria-hidden>
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-8 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            ))
          ) : visibleRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            visibleRows.map((row) => (
              <article key={`mobile-${rowKey(row)}`} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <dl className="space-y-1.5">
                      {columns.filter((column) => !column.hideOnMobile && !column.mobileFullWidth).map((column, index) => (
                        <div key={column.key} className={cn('flex justify-between gap-3 text-sm', index === 0 && 'font-medium')}>
                          <dt className="shrink-0 text-muted-foreground">{column.header}</dt>
                          <dd className={cn('min-w-0 text-right break-words', column.align === 'right' && 'tabular-nums')}>{column.cell(row)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {selectable ? <div className="pt-0.5">{selectionCell(row)}</div> : null}
                </div>
                {columns.filter((column) => column.mobileFullWidth).map((column) => (
                  <div key={column.key} className="mt-3 border-t pt-3">
                    {column.cell(row)}
                  </div>
                ))}
              </article>
            ))
          )}
        </div>
      ) : null}

      <div className={cn('overflow-x-auto print:max-h-none print:overflow-visible', visibleRows.length > 0 && 'max-h-[70vh]')}>
        <table className="hidden w-full border-collapse text-left text-sm md:table print:table">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b bg-card">
              {selectable ? (
                <th scope="col" className={cn('w-10', padding)}>
                  <SelectAllCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    label={t('ops.table.selectAll')}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const isSorted = sortKey === column.key && Boolean(column.sortValue)
                const ariaSort = isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'whitespace-nowrap font-medium text-muted-foreground',
                      padding,
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.headerClassName,
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(column)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                        aria-label={t('ops.table.sortBy', { column: column.header })}
                      >
                        {column.header}
                        {isSorted ? (
                          sortDirection === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody aria-busy={isLoading || undefined}>
            {isLoading ? (
              Array.from({ length: loadingRows }, (_, index) => (
                <tr key={`skeleton-${index}`} className="border-b last:border-0">
                  {selectable ? <td className={padding} /> : null}
                  {columns.map((column, columnIndex) => (
                    <td key={column.key} className={cn(padding, column.cellClassName)} aria-hidden>
                      <div
                        className={cn('h-4 animate-pulse rounded bg-muted motion-reduce:animate-none', columnIndex === 0 ? 'w-3/4' : 'w-1/2')}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/40">
                  {selectable ? <td className={padding}>{selectionCell(row)}</td> : null}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        padding,
                        column.align === 'right' && 'text-right tabular-nums',
                        column.align === 'center' && 'text-center',
                        column.cellClassName,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footer ? <div className="border-t px-3 py-3 print:hidden">{footer}</div> : null}
    </div>
  )
}
