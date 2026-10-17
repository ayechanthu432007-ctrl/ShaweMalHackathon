import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, FlaskConical, Printer, Rocket } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { agentHousesApi } from '../api/agent-houses-api'
import { agentPlanApi, formatDate, formatMmk, type Boost, type Totals } from '../api/agent-plan-api'
import { BarSeries, PageHeading, QueryState, StatTile, UpgradePrompt } from '../components/dashboard-parts'
import { AGENT_DASHBOARD_QUERY_KEY, useAgentDashboard } from '../layout/AgentDashboardLayout'
import { activeDemoBoost, DemoBoostError, useAgentDemoPreview, withDemoBoost } from '../lib/agent-demo-preview'

const BOOST_TONE: Record<Boost['status'], string> = {
  ACTIVE: 'bg-success-soft text-success-ink',
  SCHEDULED: 'bg-warning-soft text-warning',
  PAUSED: 'bg-warning-soft text-warning',
  ENDED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export function AgentBoostsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dashboardQuery = useAgentDashboard()
  const dashboard = dashboardQuery.data
  const [houseId, setHouseId] = useState('')
  const [days, setDays] = useState(1)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const housesQuery = useQuery({ queryKey: ['agent-houses'], queryFn: () => agentHousesApi.list() })
  // Live site: the server refuses simulated payments, so boosts are tried as a browser-only demo.
  const preview = useAgentDemoPreview(dashboard)
  const [demoConfirm, setDemoConfirm] = useState<{ houseId: string; title: string; days: number; amountMmk: number } | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const boostsQuery = useQuery({ queryKey: ['agent', 'boosts'], queryFn: async () => (await agentPlanApi.boosts()).items })

  const onError = (err: unknown) => setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : t('agentDash.boostFailed') })

  const freeMutation = useMutation({
    mutationFn: () => agentPlanApi.applyFreeBoost(houseId, days),
    onSuccess: async () => {
      setMessage({ tone: 'ok', text: t('agentDash.freeBoostApplied') })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['agent', 'boosts'] }), queryClient.invalidateQueries({ queryKey: AGENT_DASHBOARD_QUERY_KEY })])
    },
    onError,
  })

  const buyMutation = useMutation({
    mutationFn: () => agentPlanApi.createBoostOrder(houseId, days),
    onSuccess: ({ order }) => navigate(`/agent/checkout/${order.reference}`),
    onError,
  })

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.boosts')} />
        <QueryState isLoading={dashboardQuery.isLoading} isError={dashboardQuery.isError} onRetry={() => void dashboardQuery.refetch()} />
      </div>
    )
  }

  const houses = (housesQuery.data?.items ?? []).filter((house) => String(house.availability).toUpperCase() === 'AVAILABLE')
  const { freeBoost } = dashboard
  const busy = freeMutation.isPending || buyMutation.isPending
  const canSubmit = Boolean(houseId) && days >= 1 && days <= 30 && !busy
  const now = Date.now()
  const selectedDemoBoost = preview.enabled && houseId ? activeDemoBoost(preview.state, houseId, now) : null
  const demoBoosts = preview.state.boosts
  const finishDemo = (outcome: 'success' | 'failed') => {
    if (!demoConfirm) return
    if (outcome === 'failed') {
      setMessage({ tone: 'error', text: t('agentDash.demoBoostFailed', { title: demoConfirm.title }) })
      setDemoConfirm(null)
      return
    }
    try {
      preview.update((current) => withDemoBoost(current, demoConfirm))
      setMessage({ tone: 'ok', text: t('agentDash.demoBoostDone', { title: demoConfirm.title, days: demoConfirm.days }) })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof DemoBoostError && err.code === 'ALREADY_BOOSTED' ? t('agentDash.demoBoostDuplicate') : t('agentDash.boostFailed') })
    }
    setDemoConfirm(null)
  }

  return (
    <div className="space-y-6">
      <PageHeading title={t('agentDash.nav.boosts')} subtitle={t('agentDash.boostsSubtitle')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label={t('agentDash.activeBoostsLabel')} value={dashboard.activeBoosts} />
        <StatTile
          label={t('agentDash.freeBoostDays')}
          value={freeBoost.granted > 0 ? `${freeBoost.remaining} / ${freeBoost.granted}` : '0'}
          hint={freeBoost.granted > 0 ? t('agentDash.freeBoostExpires', { date: formatDate(freeBoost.expiresAt) }) : t('agentDash.noFreeBoost')}
        />
        <StatTile label={t('agentDash.pricePerDay')} value={formatMmk(dashboard.boostPricePerDay)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('agentDash.boostAListing')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {housesQuery.isLoading ? <LoadingState /> : null}
          {!housesQuery.isLoading && houses.length === 0 ? <p className="text-muted-foreground">{t('agentDash.noBoostableListings')}</p> : null}
          {houses.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-2">
                  <Label htmlFor="boost-house">{t('agentDash.listing')}</Label>
                  <select id="boost-house" className={selectClassName} value={houseId} onChange={(event) => setHouseId(event.target.value)}>
                    <option value="">{t('agentDash.chooseListing')}</option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="boost-days">{t('agentDash.days')}</Label>
                  <select id="boost-days" className={selectClassName} value={days} onChange={(event) => setDays(Number(event.target.value))}>
                    {[1, 2, 3, 5, 7, 10, 14, 30].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.enabled ? (
                  <Button
                    type="button"
                    disabled={!canSubmit || Boolean(selectedDemoBoost)}
                    onClick={() => {
                      setMessage(null)
                      const house = houses.find((item) => item.id === houseId)
                      if (house) setDemoConfirm({ houseId, title: house.title, days, amountMmk: dashboard.boostPricePerDay * days })
                    }}
                  >
                    <Rocket aria-hidden />
                    {selectedDemoBoost ? t('agentDash.demoBoostActive') : t('agentDash.buyBoost', { amount: formatMmk(dashboard.boostPricePerDay * days) })}
                  </Button>
                ) : (
                  <Button type="button" disabled={!canSubmit || !dashboard.demoPayments} onClick={() => { setMessage(null); buyMutation.mutate() }}>
                    {t('agentDash.buyBoost', { amount: formatMmk(dashboard.boostPricePerDay * days) })}
                  </Button>
                )}
                {freeBoost.granted > 0 ? (
                  <Button type="button" variant="outline" disabled={!canSubmit || days > freeBoost.remaining} onClick={() => { setMessage(null); freeMutation.mutate() }}>
                    {t('agentDash.useFreeDays', { count: days })}
                  </Button>
                ) : null}
              </div>
              {preview.enabled ? (
                <p className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold-soft p-3 text-gold-ink">
                  <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t('agentDash.demoBoostNote')}
                </p>
              ) : !dashboard.demoPayments ? (
                <p className="text-muted-foreground">{t('agentDash.paymentsUnavailable')}</p>
              ) : null}
            </>
          ) : null}
          {message ? (
            <p className={message.tone === 'error' ? 'text-destructive' : 'text-primary'} role={message.tone === 'error' ? 'alert' : 'status'}>
              {message.text}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('agentDash.boostRules')}</p>
        </CardContent>
      </Card>

      {preview.enabled && demoBoosts.length > 0 ? (
        <section className="space-y-3" aria-labelledby="demo-boosts-title">
          <h2 id="demo-boosts-title" className="text-lg font-semibold">
            {t('agentDash.demoBoostsTitle')}
          </h2>
          <ul className="space-y-2">
            {demoBoosts.map((boost) => {
              const live = boost.activatedAt <= now && now < boost.expiresAt
              const hoursLeft = Math.max(0, Math.ceil((boost.expiresAt - now) / 3_600_000))
              return (
                <li key={boost.id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm', live && 'border-gold/60 bg-gold-soft/60')}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{boost.title}</span>
                      {live ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold-ink">
                          <Rocket className="size-3" aria-hidden />
                          {t('agentDash.demoBoostBadge')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('agentDash.boostDaysCount', { count: boost.days })} · {formatMmk(boost.amountMmk)} · {formatDate(new Date(boost.activatedAt).toISOString())} – {formatDate(new Date(boost.expiresAt).toISOString())}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{live ? t('agentDash.hoursLeft', { count: hoursLeft }) : t('agentDash.boostStatus.EXPIRED')}</span>
                </li>
              )
            })}
          </ul>
          <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => preview.update((current) => ({ ...current, boosts: [] }))}>
            {t('agentDash.demoBoostReset')}
          </Button>
        </section>
      ) : null}

      {demoConfirm ? <DemoBoostDialog boost={demoConfirm} onCancel={() => setDemoConfirm(null)} onFinish={finishDemo} /> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('agentDash.boostHistory')}</h2>
        <QueryState isLoading={boostsQuery.isLoading} isError={boostsQuery.isError} onRetry={() => void boostsQuery.refetch()} />
        {boostsQuery.data && boostsQuery.data.length === 0 ? <p className="text-sm text-muted-foreground">{t('agentDash.noBoosts')}</p> : null}
        {boostsQuery.data && boostsQuery.data.length > 0 ? (
          <ul className="space-y-2">
            {boostsQuery.data.map((boost) => (
              <li key={boost.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{boost.house.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`agentDash.boostSource.${boost.source}`)} · {t('agentDash.boostDaysCount', { count: boost.days })} · {formatDate(boost.startsAt)} – {formatDate(boost.endsAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {boost.status === 'ACTIVE' ? <span className="text-xs text-muted-foreground">{t('agentDash.hoursLeft', { count: boost.hoursRemaining })}</span> : null}
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', BOOST_TONE[boost.status])}>{t(`agentDash.boostStatus.${boost.status}`)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}

function DemoBoostDialog({
  boost,
  onCancel,
  onFinish,
}: {
  boost: { title: string; days: number; amountMmk: number }
  onCancel: () => void
  onFinish: (outcome: 'success' | 'failed') => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 [&>[role=dialog]]:my-auto">
      <div aria-hidden className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-overlay">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-ink">
          <FlaskConical className="size-3.5" aria-hidden />
          {t('agentDash.demoBadge')}
        </p>
        <h2 id={titleId} className="text-xl font-semibold tracking-tight">
          {t('agentDash.demoBoostTitle')}
        </h2>
        <dl className="space-y-1.5 rounded-xl bg-muted p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('agentDash.listing')}</dt>
            <dd className="text-right font-semibold">{boost.title}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('agentDash.days')}</dt>
            <dd className="font-semibold">{t('agentDash.boostDaysCount', { count: boost.days })}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('agentDash.amount')}</dt>
            <dd className="font-semibold tabular-nums">{formatMmk(boost.amountMmk)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{t('agentDash.demoNoCharge')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" autoFocus onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onFinish('failed')}>
            {t('agentDash.demoSimulateFailure')}
          </Button>
          <Button type="button" onClick={() => onFinish('success')}>
            {t('agentDash.demoConfirmPayment')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AgentVerificationPage() {
  const { t } = useTranslation()
  const query = useAgentDashboard()
  const dashboard = query.data

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.badge')} />
        <QueryState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const { verification, plan } = dashboard
  const steps = [
    { done: verification.status === 'VERIFIED', label: t('agentDash.badgeStepAdmin'), detail: t(`agentDash.verification.${verification.status}`) },
    { done: verification.badgeEligiblePlan, label: t('agentDash.badgeStepPlan'), detail: plan.name },
  ]

  return (
    <div className="space-y-6">
      <PageHeading title={t('agentDash.nav.badge')} subtitle={t('agentDash.badgeSubtitle')} />

      <Card>
        <CardContent className="space-y-4 p-6 text-sm">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <BadgeCheck className={cn('size-6', verification.badgeShown ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
            {verification.badgeShown ? t('agentDash.badgeOn') : t('agentDash.badgeOff')}
          </p>
          <ul className="space-y-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-3 rounded-lg border p-3">
                <span className={cn('mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium', step.done ? 'bg-success-soft text-success-ink' : 'bg-muted text-muted-foreground')}>
                  {step.done ? t('agentDash.done') : t('agentDash.notYet')}
                </span>
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {verification.status === 'REJECTED' && verification.rejectionReason ? (
            <p className="text-destructive">
              {t('agentDash.rejectionReason')}: {verification.rejectionReason}
            </p>
          ) : null}
          <p className="text-muted-foreground">{t('agentDash.badgeRule')}</p>
          <div className="flex flex-wrap gap-2">
            {verification.status === 'NOT_SUBMITTED' || verification.status === 'REJECTED' ? (
              <Button asChild>
                <Link to="/agent-register">{t('agentDash.submitDocuments')}</Link>
              </Button>
            ) : null}
            {!verification.badgeEligiblePlan ? (
              <Button asChild variant="outline">
                <Link to="/agent/subscription">{t('agentDash.viewPlans')}</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function AgentInsightsPage() {
  const { t } = useTranslation()
  const dashboardQuery = useAgentDashboard()
  const allowed = dashboardQuery.data?.features.audienceInsights ?? false
  const query = useQuery({ queryKey: ['agent', 'insights'], queryFn: async () => (await agentPlanApi.insights()).insights, enabled: allowed })
  const insights = query.data

  if (dashboardQuery.data && !allowed) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.insights')} />
        <UpgradePrompt title={t('agentDash.goldOnlyTitle')} body={t('agentDash.insightsLocked')} />
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.insights')} />
        <QueryState isLoading={query.isLoading || dashboardQuery.isLoading} isError={query.isError || dashboardQuery.isError} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const signedInShare = insights.totalViews > 0 ? Math.round((insights.signedInViews / insights.totalViews) * 100) : null

  return (
    <div className="space-y-6">
      <PageHeading title={t('agentDash.nav.insights')} subtitle={t('agentDash.insightsSubtitle')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('agentDash.metric.views')} value={insights.totalViews} />
        <StatTile label={t('agentDash.viewToInquiry')} value={insights.viewToInquiryRate === null ? '—' : `${insights.viewToInquiryRate}%`} />
        <StatTile label={t('agentDash.signedInVisitors')} value={signedInShare === null ? '—' : `${signedInShare}%`} hint={t('agentDash.signedInHint')} />
        <StatTile label={t('agentDash.metric.calls')} value={insights.contactMethods.calls} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('agentDash.viewsByHour')}</CardTitle>
        </CardHeader>
        <CardContent>
          <BarSeries unit={t('agentDash.metric.views').toLowerCase()} ariaLabel={t('agentDash.viewsByHour')} tickEvery={3} data={insights.viewsByHour.map((value, hour) => ({ label: String(hour), title: `${String(hour).padStart(2, '0')}:00`, value }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('agentDash.viewsByWeekday')}</CardTitle>
        </CardHeader>
        <CardContent>
          <BarSeries unit={t('agentDash.metric.views').toLowerCase()} ariaLabel={t('agentDash.viewsByWeekday')} data={insights.viewsByWeekday.map((value, index) => ({ label: t(`agentDash.weekday.${WEEKDAY_KEYS[index]}`), value }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('agentDash.contactMethods')}</CardTitle>
        </CardHeader>
        <CardContent>
          <BarSeries
            unit={t('agentDash.metric.inquiries').toLowerCase()}
            ariaLabel={t('agentDash.contactMethods')}
            data={[
              { label: t('agentDash.metric.calls'), value: insights.contactMethods.calls },
              { label: 'Telegram', value: insights.contactMethods.telegram },
              { label: 'Viber', value: insights.contactMethods.viber },
              { label: t('agentDash.bookings'), value: insights.contactMethods.bookings },
            ]}
          />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{t('agentDash.insightsNote')}</p>
    </div>
  )
}

function change(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0' : '+' + current
  const percent = Math.round(((current - previous) / previous) * 100)
  return `${percent >= 0 ? '+' : ''}${percent}%`
}

export function AgentReportsPage() {
  const { t } = useTranslation()
  const dashboardQuery = useAgentDashboard()
  const allowed = dashboardQuery.data?.features.monthlyReport ?? false
  const [month, setMonth] = useState<string | undefined>(undefined)
  const query = useQuery({ queryKey: ['agent', 'report', month ?? 'current'], queryFn: async () => (await agentPlanApi.monthlyReport(month)).report, enabled: allowed })
  const report = query.data

  if (dashboardQuery.data && !allowed) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.reports')} />
        <UpgradePrompt title={t('agentDash.goldOnlyTitle')} body={t('agentDash.reportsLocked')} />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.reports')} />
        <QueryState isLoading={query.isLoading || dashboardQuery.isLoading} isError={query.isError || dashboardQuery.isError} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const rows: Array<{ key: keyof Totals; label: string }> = [
    { key: 'views', label: t('agentDash.metric.views') },
    { key: 'inquiries', label: t('agentDash.metric.inquiries') },
    { key: 'calls', label: t('agentDash.metric.calls') },
    { key: 'bookings', label: t('agentDash.bookings') },
  ]

  return (
    <div className="space-y-6">
      <PageHeading
        title={t('agentDash.nav.reports')}
        subtitle={report.isPartial ? t('agentDash.reportPartial', { month: report.month }) : report.month}
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <input
              type="month"
              aria-label={t('agentDash.reportMonth')}
              className={cn(selectClassName, 'w-auto')}
              value={report.month}
              max={new Date().toISOString().slice(0, 7)}
              onChange={(event) => setMonth(event.target.value || undefined)}
            />
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {t('agentDash.print')}
            </Button>
          </div>
        }
      />

      <div className="relative overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">{t('agentDash.metricLabel')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{report.month}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{report.previousMonth}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.change')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">{row.label}</th>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{report.totals[row.key]}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{report.previousTotals[row.key]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{change(report.totals[row.key], report.previousTotals[row.key])}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-3 py-2 text-left font-normal">{t('agentDash.newListings')}</th>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{report.newListings}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('agentDash.byListing')}</h2>
        {report.listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('agentDash.noListings')}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">{t('agentDash.listing')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.metric.views')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.metric.inquiries')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.metric.calls')}</th>
                </tr>
              </thead>
              <tbody>
                {report.listings.map((row) => (
                  <tr key={row.house.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{row.house.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.views}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.inquiries}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">{t('agentDash.metricDefinitions')}</p>
    </div>
  )
}
