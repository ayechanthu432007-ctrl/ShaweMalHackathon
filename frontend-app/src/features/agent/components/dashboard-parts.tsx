import { Lock, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
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

export { BarSeries, type BarDatum } from '@/components/operational/bar-chart'
