import { Lock, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Colour pairs for the small icon squares; each is readable in light and dark themes. */
export const ICON_TONES = {
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  neutral: 'bg-muted text-muted-foreground',
} as const

export type IconTone = keyof typeof ICON_TONES

export function IconBadge({ icon: Icon, tone = 'neutral', className }: { icon: LucideIcon; tone?: IconTone; className?: string }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone], className)}>
      <Icon className="size-[18px]" aria-hidden />
    </span>
  )
}

type StatTileProps = {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: IconTone
  /** When set, the whole tile opens this page. */
  to?: string
}

export function StatTile({ label, value, hint, icon, tone, to }: StatTileProps) {
  const content = (
    <>
      {icon ? <IconBadge icon={icon} tone={tone} className="mb-3" /> : null}
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  )
  const className = 'block rounded-xl border bg-card p-4 shadow-sm'

  return to ? (
    <Link to={to} className={cn(className, 'transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** Shown in place of a premium page when the agent's plan does not include it. */
export function UpgradePrompt({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()
  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col items-start gap-3 p-6">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button asChild>
          <Link to="/agent/subscription">{t('agentDash.viewPlans')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function QueryState({ isLoading, isError, onRetry }: { isLoading: boolean; isError: boolean; onRetry: () => void }) {
  const { t } = useTranslation()
  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive" role="alert">
          {t('agentDash.loadError')}
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }
  return null
}

type BarDatum = { label: string; value: number; title?: string }

/**
 * Single-series bar chart: one measure, one hue. Every bar has a hover/focus readout and
 * the same numbers are available as a table, so nothing depends on colour or on hovering.
 */
export function BarSeries({ data, unit, ariaLabel, tickEvery = 1 }: { data: BarDatum[]; unit: string; ariaLabel: string; tickEvery?: number }) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const max = Math.max(1, ...data.map((item) => item.value))
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const shown = active !== null ? data[active] : null

  if (total === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('agentDash.noData')}</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {shown ? (
            <>
              <span className="font-medium text-foreground">{shown.title ?? shown.label}</span>: <span className="tabular-nums">{shown.value}</span> {unit}
            </>
          ) : (
            t('agentDash.chartHint')
          )}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowTable((value) => !value)}>
          {showTable ? t('agentDash.showChart') : t('agentDash.showTable')}
        </Button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
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
