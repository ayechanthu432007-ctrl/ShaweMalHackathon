import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { downloadCsv, todayStamp } from '@/components/operational/export'
import { cn } from '@/lib/utils'

export type BarDatum = { label: string; value: number; title?: string }

type BarSeriesProps = {
  data: BarDatum[]
  unit: string
  ariaLabel: string
  tickEvery?: number
  /** Adds an Export CSV action beside the chart/table toggle. */
  exportFileName?: string
}

/**
 * Single-series bar chart: one measure, one hue. Every bar has a hover/focus readout and
 * the same numbers are available as a table, so nothing depends on colour or on hovering.
 */
export function BarSeries({ data, unit, ariaLabel, tickEvery = 1, exportFileName }: BarSeriesProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const max = Math.max(1, ...data.map((item) => item.value))
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const shown = active !== null ? data[active] : null

  if (total === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('ops.chart.noData')}</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-sm print:hidden">
        <p className="text-muted-foreground" aria-live="polite">
          {shown ? (
            <>
              <span className="font-medium text-foreground">{shown.title ?? shown.label}</span>: <span className="tabular-nums">{shown.value}</span> {unit}
            </>
          ) : (
            t('ops.chart.hint')
          )}
        </p>
        <div className="flex items-center gap-1">
          {exportFileName ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadCsv(`${exportFileName}-${todayStamp()}`, [
                  { header: t('ops.chart.label'), value: (row: BarDatum) => row.title ?? row.label },
                  { header: t('ops.chart.value'), value: (row: BarDatum) => row.value },
                ], data)
              }
            >
              <Download className="size-4" aria-hidden />
              {t('ops.export.csv')}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowTable((value) => !value)}>
            {showTable ? t('ops.chart.showChart') : t('ops.chart.showTable')}
          </Button>
        </div>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{ariaLabel}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-1.5 font-medium">{t('ops.chart.label')}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t('ops.chart.value')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.label + (item.title ?? '')} className="border-b last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">
                    {item.title ?? item.label}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={ariaLabel}>
          <div className="flex h-40 items-end gap-0.5 border-b border-border" onMouseLeave={() => setActive(null)}>
            {data.map((item, index) => (
              // Pointer-only highlight; the chart's data is announced through the label and the table view.
              <div
                key={item.label + index}
                aria-hidden
                className="group flex h-full min-w-0 flex-1 items-end"
                onMouseEnter={() => setActive(index)}
                onClick={() => setActive(index)}
              >
                <span
                  className={cn('w-full rounded-t bg-primary transition-opacity', active !== null && active !== index && 'opacity-40')}
                  style={{ height: item.value === 0 ? 0 : `max(2px, ${(item.value / max) * 100}%)` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-0.5 text-[10px] text-muted-foreground" aria-hidden>
            {data.map((item, index) => (
              <span key={item.label + index} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                {index % tickEvery === 0 ? item.label : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
