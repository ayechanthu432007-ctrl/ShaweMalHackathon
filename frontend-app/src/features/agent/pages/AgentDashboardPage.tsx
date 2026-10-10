import { BadgeCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { formatDate } from '../api/agent-plan-api'
import { PageHeading, QueryState, StatTile } from '../components/dashboard-parts'
import { useAgentDashboard } from '../layout/AgentDashboardLayout'

export function AgentDashboardPage() {
  const { t } = useTranslation()
  const query = useAgentDashboard()
  const dashboard = query.data

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.dashboard')} />
        <QueryState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const { listingUsage: usage, subscription, plan, last30Days: stats, freeBoost, verification } = dashboard
  const usagePercent = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0
  const limitReached = usage.limit !== null && usage.remaining === 0

  return (
    <div className="space-y-6">
      <PageHeading
        title={t('agentDash.nav.dashboard')}
        subtitle={t('agentDash.overviewSubtitle')}
        action={
          <Button asChild>
            <Link to="/agent/houses/new">{t('agentDash.newListing')}</Link>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('agentDash.currentPlan')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-semibold">{plan.name}</span>
              {verification.badgeShown ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t('agentDash.verifiedBadge')}
                </span>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">{t('agentDash.status')}</dt>
              <dd>{t(`agentDash.subscriptionStatus.${subscription.status}`)}</dd>
              <dt className="text-muted-foreground">{t('agentDash.expires')}</dt>
              <dd>
                {subscription.endsAt ? `${formatDate(subscription.endsAt)} (${t('agentDash.daysLeft', { count: subscription.daysRemaining ?? 0 })})` : '—'}
              </dd>
            </dl>
            <Button asChild variant="outline" size="sm">
              <Link to="/agent/subscription">{subscription.status === 'ACTIVE' ? t('agentDash.managePlan') : t('agentDash.viewPlans')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('agentDash.listingAllowance')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {usage.limit === null ? t('agentDash.usedUnlimited', { used: usage.used }) : t('agentDash.usedOfLimit', { used: usage.used, limit: usage.limit })}
            </p>
            {usage.limit !== null ? (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-valuenow={Math.min(usage.used, usage.limit)}
                aria-label={t('agentDash.listingAllowance')}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${usagePercent}%` }} />
              </div>
            ) : null}
            <p className="text-muted-foreground">
              {usage.limit === null ? t('agentDash.unlimitedNote') : t('agentDash.remainingNote', { count: usage.remaining ?? 0, date: formatDate(usage.resetsAt) })}
            </p>
            {limitReached ? (
              <p className="text-destructive" role="status">
                {t('agentDash.limitReached')}{' '}
                <Link to="/agent/subscription" className="font-medium underline underline-offset-4">
                  {t('agentDash.upgrade')}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('agentDash.last30Days')}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t('agentDash.metric.views')} value={stats.views} />
          <StatTile label={t('agentDash.metric.inquiries')} value={stats.inquiries} hint={t('agentDash.inquiriesHint', { bookings: stats.bookings })} />
          <StatTile label={t('agentDash.metric.calls')} value={stats.calls} />
          <StatTile label={t('agentDash.totalListings')} value={dashboard.listingCount} />
        </div>
        <p className="text-xs text-muted-foreground">{t('agentDash.metricDefinitions')}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('agentDash.nav.boosts')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t('agentDash.activeBoosts', { count: dashboard.activeBoosts })}</p>
            <p className="text-muted-foreground">
              {freeBoost.granted > 0 ? t('agentDash.freeBoostLeft', { remaining: freeBoost.remaining, granted: freeBoost.granted }) : t('agentDash.noFreeBoost')}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/agent/boosts">{t('agentDash.manageBoosts')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('agentDash.nav.badge')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t(`agentDash.verification.${verification.status}`)}</p>
            <p className="text-muted-foreground">{verification.badgeShown ? t('agentDash.badgeOn') : t('agentDash.badgeOff')}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/agent/verification">{t('agentDash.details')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
