import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Eye,
  FileChartColumn,
  House,
  MessagesSquare,
  Phone,
  Plus,
  Rocket,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { displayedPlan, useAgentDemoPreview } from '../lib/agent-demo-preview'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { agentPlanApi, formatDate } from '../api/agent-plan-api'
import { BarSeries, IconBadge, PageHeading, QueryState, StatTile, type IconTone } from '../components/dashboard-parts'
import { useAgentDashboard } from '../layout/AgentDashboardLayout'

/** One figure in the plan summary band. */
function PlanFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{children}</dd>
    </div>
  )
}

/** A shortcut to one of the agent tools, with its current state in a line or two. */
function FeatureCard({ icon, tone, title, lines, to, action }: { icon: LucideIcon; tone: IconTone; title: string; lines: string[]; to: string; action: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconBadge icon={icon} tone={tone} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {lines.map((line, index) => (
          <p key={line} className={index === 0 ? 'mt-0.5' : 'text-muted-foreground'}>
            {line}
          </p>
        ))}
        <p className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-primary">
          {action}
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </p>
      </div>
    </Link>
  )
}

export function AgentDashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const query = useAgentDashboard()
  const dashboard = query.data
  const preview = useAgentDemoPreview(dashboard)

  // The same day-by-day data the Performance page shows; plans without the chart get totals only.
  const performanceQuery = useQuery({
    queryKey: ['agent', 'performance', 30],
    queryFn: async () => (await agentPlanApi.performance(30)).performance,
    enabled: Boolean(dashboard?.features.performanceOverview),
  })

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.dashboard')} />
        <QueryState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const { listingUsage: usage, subscription, last30Days: stats, freeBoost, verification, features } = dashboard
  const usagePercent = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0
  const limitReached = usage.limit !== null && usage.remaining === 0
  // In the demo preview the chosen plan is shown; limits and features below stay on the real plan.
  const shown = displayedPlan(dashboard, preview)
  const isGold = shown.plan.code === 'GOLD'
  const series = performanceQuery.data?.series ?? null

  return (
    <div className="space-y-6">
      <PageHeading
        title={user?.name ? t('agentDash.greeting', { name: user.name }) : t('agentDash.nav.dashboard')}
        subtitle={t('agentDash.greetingSubtitle')}
        action={
          <Button asChild>
            <Link to="/agent/houses/new">
              <Plus aria-hidden />
              {t('agentDash.newListing')}
            </Link>
          </Button>
        }
      />

      {subscription.status === 'EXPIRED' ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="status">
          {t('agentDash.expiredNotice')}{' '}
          <Link to="/agent/subscription" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('agentDash.renew')}
          </Link>
        </p>
      ) : null}

      {/* Plan summary: gold accents mark the premium plan, every other plan uses the neutral band. */}
      <section
        aria-label={t('agentDash.currentPlan')}
        className={cn(
          'space-y-4 rounded-xl border p-4 shadow-sm sm:p-5',
          isGold ? 'border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'bg-primary/5',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <PlanFact label={t('agentDash.currentPlan')}>
              <span className="flex flex-wrap items-center gap-2">
                {shown.plan.name}
                {shown.isDemo ? <span className="rounded bg-[#FCF7EE] px-1.5 py-0.5 text-[10px] font-semibold text-[#7A5418]">DEMO</span> : null}
                {verification.badgeShown ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-primary">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    {t('agentDash.verifiedBadge')}
                  </span>
                ) : null}
              </span>
            </PlanFact>
            <PlanFact label={t('agentDash.listingsLeft')}>
              {usage.limit === null ? t('agentDash.unlimited') : t('agentDash.perMonthShort', { count: usage.remaining ?? 0 })}
            </PlanFact>
            <PlanFact label={t('agentDash.freeBoostDays')}>
              <span className="inline-flex items-center gap-1.5">
                <Rocket className={cn('size-4', isGold ? 'text-amber-500' : 'text-primary')} aria-hidden />
                {t('agentDash.daysCount', { count: freeBoost.remaining })}
              </span>
            </PlanFact>
          </dl>
          <Button asChild variant="outline" size="sm" className="bg-background/80">
            <Link to="/agent/subscription">{subscription.status === 'ACTIVE' ? t('agentDash.managePlan') : t('agentDash.viewPlans')}</Link>
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <p className="tabular-nums">
            {usage.limit === null ? t('agentDash.usedUnlimited', { used: usage.used }) : t('agentDash.usedOfLimit', { used: usage.used, limit: usage.limit })}
            <span className="text-muted-foreground">
              {' · '}
              {usage.limit === null ? t('agentDash.unlimitedNote') : t('agentDash.remainingNote', { count: usage.remaining ?? 0, date: formatDate(usage.resetsAt) })}
            </span>
          </p>
          {usage.limit !== null ? (
            <div
              className="h-2 overflow-hidden rounded-full bg-background/80"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={usage.limit}
              aria-valuenow={Math.min(usage.used, usage.limit)}
              aria-label={t('agentDash.listingAllowance')}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${usagePercent}%` }} />
            </div>
          ) : null}
          {limitReached ? (
            <p className="text-destructive" role="status">
              {t('agentDash.limitReached')}{' '}
              <Link to="/agent/subscription" className="font-medium underline underline-offset-4">
                {t('agentDash.upgrade')}
              </Link>
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden />
            {subscription.endsAt
              ? `${t('agentDash.packageExpires', { date: formatDate(subscription.endsAt) })} (${t('agentDash.daysLeft', { count: subscription.daysRemaining ?? 0 })})`
              : t('agentDash.noExpiry')}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('agentDash.last30Days')}</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile icon={House} tone="blue" to="/agent/houses" label={t('agentDash.myListings')} value={dashboard.listingCount} hint={t('agentDash.activeListings')} />
          <StatTile icon={Eye} tone="violet" to="/agent/performance?metric=views" label={t('agentDash.nav.views')} value={stats.views} />
          <StatTile
            icon={MessagesSquare}
            tone="green"
            to="/agent/bookings"
            label={t('agentDash.metric.inquiries')}
            value={stats.inquiries}
            hint={t('agentDash.inquiriesHint', { bookings: stats.bookings })}
          />
          <StatTile icon={Phone} tone="amber" to="/agent/performance?metric=calls" label={t('agentDash.nav.calls')} value={stats.calls} />
        </div>
        <p className="text-xs text-muted-foreground">{t('agentDash.metricDefinitions')}</p>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">{t('agentDash.nav.performance')}</CardTitle>
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link to="/agent/performance">{t('agentDash.viewDetails')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!features.performanceOverview ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t('agentDash.chartLocked')}{' '}
              <Link to="/agent/subscription" className="font-medium text-primary underline-offset-4 hover:underline">
                {t('agentDash.viewPlans')}
              </Link>
            </p>
          ) : series ? (
            <BarSeries
              data={series.map((point) => ({ label: point.day.slice(8), title: formatDate(point.day), value: point.views }))}
              unit={t('agentDash.metric.views').toLowerCase()}
              ariaLabel={t('agentDash.viewsPerDay')}
              tickEvery={5}
            />
          ) : (
            <QueryState isLoading={performanceQuery.isLoading} isError={performanceQuery.isError} onRetry={() => void performanceQuery.refetch()} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <FeatureCard
          icon={Rocket}
          tone="green"
          title={t('agentDash.nav.boosts')}
          lines={[
            t('agentDash.activeBoosts', { count: dashboard.activeBoosts }),
            freeBoost.granted > 0 ? t('agentDash.freeBoostLeft', { remaining: freeBoost.remaining, granted: freeBoost.granted }) : t('agentDash.noFreeBoost'),
          ]}
          to="/agent/boosts"
          action={t('agentDash.manageBoosts')}
        />
        <FeatureCard
          icon={ShieldCheck}
          tone="blue"
          title={t('agentDash.nav.badge')}
          lines={[t(`agentDash.verification.${verification.status}`), verification.badgeShown ? t('agentDash.badgeOn') : t('agentDash.badgeOff')]}
          to="/agent/verification"
          action={t('agentDash.details')}
        />
        {features.audienceInsights ? (
          <FeatureCard icon={Users} tone="violet" title={t('agentDash.nav.insights')} lines={[]} to="/agent/insights" action={t('agentDash.viewDetails')} />
        ) : null}
        {features.monthlyReport ? (
          <FeatureCard icon={FileChartColumn} tone="amber" title={t('agentDash.nav.reports')} lines={[]} to="/agent/reports" action={t('agentDash.viewReport')} />
        ) : null}
      </div>
    </div>
  )
}
