import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, FlaskConical } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import freeBasicArt from '@/assets/plans/free-basic.svg'
import goldPremiumArt from '@/assets/plans/gold-premium.svg'
import silverPartnerArt from '@/assets/plans/silver-partner.svg'

import { agentPlanApi, formatDate, formatMmk, type PaymentOrder, type Plan } from '../api/agent-plan-api'
import { PageHeading, QueryState } from '../components/dashboard-parts'
import { displayedPlan, useAgentDemoPreview } from '../lib/agent-demo-preview'
import { AGENT_DASHBOARD_QUERY_KEY, useAgentDashboard } from '../layout/AgentDashboardLayout'

/** Artwork and accent for each plan card; plans not listed fall back to the Free look. */
const PLAN_LOOK: Record<string, { art: string; ring: string; tint: string }> = {
  FREE: { art: freeBasicArt, ring: 'ring-[#5B9BD5]', tint: 'from-[#F4F8FC]' },
  SILVER: { art: silverPartnerArt, ring: 'ring-[#9AA6B6]', tint: 'from-[#F6F8FB]' },
  GOLD: { art: goldPremiumArt, ring: 'ring-[#C69245]', tint: 'from-[#FCF7EE]' },
}

type DemoAction = { kind: 'choose'; plan: Plan; reset: boolean } | { kind: 'free'; plan: Plan }

const STATUS_TONE: Record<PaymentOrder['status'], string> = {
  PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  PAID: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  FAILED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-muted text-muted-foreground',
}

function planFeatures(plan: Plan, t: (key: string, options?: Record<string, unknown>) => string): string[] {
  return [
    plan.monthlyListingLimit === null ? t('agentDash.feature.unlimitedListings') : t('agentDash.feature.listings', { count: plan.monthlyListingLimit }),
    t('agentDash.feature.directContact'),
    t(`agentDash.feature.performance.${plan.performanceLevel}`),
    plan.freeBoostDays > 0 ? t('agentDash.feature.freeBoost', { count: plan.freeBoostDays }) : t('agentDash.feature.paidBoostOnly'),
    ...(plan.badgeEligible ? [t('agentDash.feature.badge')] : []),
    ...(plan.audienceInsights ? [t('agentDash.nav.insights')] : []),
    ...(plan.monthlyReport ? [t('agentDash.nav.reports')] : []),
  ]
}

export function AgentSubscriptionPage() {
  const { t } = useTranslation()
  const dashboardQuery = useAgentDashboard()
  const dashboard = dashboardQuery.data
  const preview = useAgentDemoPreview(dashboard)
  const previewMode = preview.enabled
  const [billingMonths, setBillingMonths] = useState<1 | 3>(1)
  const [error, setError] = useState<string | null>(null)

  const ordersQuery = useQuery({ queryKey: ['agent', 'orders'], queryFn: async () => (await agentPlanApi.orders()).items })


  // Demo mode (never in production): confirm in a dialog, then create the order and mark it paid
  // through the server's demo checkout. Switching to a lower plan first returns to Free Basic.
  const queryClient = useQueryClient()
  const [demoAction, setDemoAction] = useState<DemoAction | null>(null)
  const [demoNote, setDemoNote] = useState<string | null>(null)
  const demoMutation = useMutation({
    mutationFn: async (action: DemoAction) => {
      if (previewMode) {
        // Nothing is sent to the server: the choice is kept in this browser and shown on every agent page.
        preview.update((current) => ({ ...current, plan: action.kind === 'free' ? null : { code: action.plan.code, billingMonths, chosenAt: Date.now() } }))
        return
      }
      if (action.kind === 'free' || action.reset) await agentPlanApi.resetDemoSubscription()
      if (action.kind === 'choose') {
        const { order } = await agentPlanApi.createSubscriptionOrder(action.plan.code, billingMonths)
        await agentPlanApi.simulateDemoPayment(order.reference, 'success')
      }
    },
    onSuccess: async (_result, action) => {
      setDemoAction(null)
      setDemoNote(t('agentDash.demoSwitched', { plan: action.plan.name }))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AGENT_DASHBOARD_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['agent', 'orders'] }),
      ])
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : t('agentDash.demoFailed')),
  })

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.subscription')} />
        <QueryState isLoading={dashboardQuery.isLoading} isError={dashboardQuery.isError} onRetry={() => void dashboardQuery.refetch()} />
      </div>
    )
  }

  const realPlan = dashboard.plan
  const shown = displayedPlan(dashboard, preview)
  const previewPlan = shown.isDemo ? shown.plan : null
  // In the preview the chosen plan is shown as current; everything the server decides stays on the real plan.
  const current = previewPlan ?? realPlan
  const isActive = previewPlan ? previewPlan.code !== 'FREE' : dashboard.subscription.status === 'ACTIVE'
  const demoOn = dashboard.demoPayments || previewMode

  return (
    <div className="space-y-6">
      <PageHeading title={t('agentDash.nav.subscription')} subtitle={t('agentDash.subscriptionSubtitle')} />

      <div className="rounded-xl border bg-card p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{t('agentDash.currentPlan')}: </span>
          <span className="font-semibold">{current.name}</span>
          {previewPlan ? <span className="ml-2 rounded bg-[#FCF7EE] px-1.5 py-0.5 text-[10px] font-semibold text-[#7A5418]">DEMO</span> : null}
          {isActive ? ` · ${t('agentDash.validUntil', { date: formatDate(dashboard.subscription.endsAt) })}` : ''}
        </p>
        {dashboard.subscription.status === 'EXPIRED' ? <p className="mt-1 text-destructive">{t('agentDash.expiredNotice')}</p> : null}
      </div>

      {demoOn ? (
        <p className="flex items-start gap-2 rounded-xl border border-[#C69245]/40 bg-[#FCF7EE] p-4 text-sm font-medium text-[#7A5418] dark:bg-amber-500/10 dark:text-amber-200" role="status">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('agentDash.demoBanner')}
            {previewMode ? <span className="mt-1 block font-normal">{t('agentDash.demoPreviewNote', { plan: realPlan.name })}</span> : null}
          </span>
        </p>
      ) : (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status">
          {t('agentDash.paymentsUnavailable')}
        </p>
      )}
      {demoNote ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300" role="status">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {demoNote}
        </p>
      ) : null}

      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t('agentDash.billingPeriod')}>
        {([1, 3] as const).map((value) => (
          <Button key={value} type="button" size="sm" variant={billingMonths === value ? 'default' : 'ghost'} aria-pressed={billingMonths === value} onClick={() => setBillingMonths(value)}>
            {value === 1 ? t('agentDash.monthly') : t('agentDash.threeMonths')}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.plans.map((plan) => {
          const price = billingMonths === 3 ? plan.quarterlyPriceMmk : plan.monthlyPriceMmk
          const isCurrent = plan.code === current.code
          const isLower = isActive && plan.rank < current.rank
          const isFree = plan.code === 'FREE'
          const look = PLAN_LOOK[plan.code] ?? PLAN_LOOK.FREE
          return (
            <Card
              key={plan.code}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-md',
                isCurrent && cn('ring-2', look.ring),
              )}
            >
              <div className={cn('bg-gradient-to-b to-transparent p-3 pb-0', look.tint)}>
                <img src={look.art} alt="" className="aspect-[2/1] w-full rounded-xl object-cover" />
              </div>
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-lg">
                  {plan.name}
                  {isCurrent ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{t('agentDash.current')}</span> : null}
                </CardTitle>
                <p className="text-2xl font-semibold tabular-nums">{isFree ? formatMmk(0) : formatMmk(price)}</p>
                <p className="text-xs text-muted-foreground">
                  {isFree ? t('agentDash.freeForever') : billingMonths === 3 ? t('agentDash.per3Months') : t('agentDash.perMonth')}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 text-sm">
                <ul className="space-y-1.5">
                  {planFeatures(plan, t).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <Button type="button" variant="secondary" className="w-full" disabled>
                      {t('agentDash.currentPlanButton')}
                    </Button>
                  ) : demoOn ? (
                    <Button
                      type="button"
                      variant={isFree ? 'outline' : 'default'}
                      className="w-full"
                      disabled={demoMutation.isPending}
                      onClick={() => {
                        setError(null)
                        setDemoNote(null)
                        setDemoAction(isFree ? { kind: 'free', plan } : { kind: 'choose', plan, reset: isLower })
                      }}
                    >
                      {isFree ? t('agentDash.returnToFree') : t('agentDash.choosePlan', { plan: plan.name })}
                    </Button>
                  ) : isFree ? null : isLower ? (
                    <p className="text-xs text-muted-foreground">{t('agentDash.downgradeNote')}</p>
                  ) : (
                    <Button type="button" className="w-full" disabled>
                      {t('agentDash.choosePlan', { plan: plan.name })}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('agentDash.planRules')}</p>

      {demoAction ? (
        <DemoPlanDialog
          action={demoAction}
          billingMonths={billingMonths}
          isPending={demoMutation.isPending}
          onCancel={() => setDemoAction(null)}
          onConfirm={() => {
            if (!demoMutation.isPending) demoMutation.mutate(demoAction)
          }}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('agentDash.paymentHistory')}</h2>
        <QueryState isLoading={ordersQuery.isLoading} isError={ordersQuery.isError} onRetry={() => void ordersQuery.refetch()} />
        {ordersQuery.data && ordersQuery.data.length === 0 ? <p className="text-sm text-muted-foreground">{t('agentDash.noOrders')}</p> : null}
        {ordersQuery.data && ordersQuery.data.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">{t('agentDash.orderRef')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('agentDash.item')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.amount')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('agentDash.status')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('agentDash.date')}</th>
                </tr>
              </thead>
              <tbody>
                {ordersQuery.data.map((order) => (
                  <tr key={order.reference} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link to={`/agent/checkout/${order.reference}`} className="font-mono text-xs hover:underline">
                        {order.reference}
                      </Link>
                      {order.isDemo ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">DEMO</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      {order.kind === 'SUBSCRIPTION' ? `${order.plan?.name ?? ''} · ${t('agentDash.monthsCount', { count: order.billingMonths ?? 0 })}` : t('agentDash.boostDaysCount', { count: order.boostDays ?? 0 })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMmk(order.amountMmk)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[order.status])}>{t(`agentDash.orderStatus.${order.status}`)}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function DemoPlanDialog({
  action,
  billingMonths,
  isPending,
  onCancel,
  onConfirm,
}: {
  action: DemoAction
  billingMonths: 1 | 3
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const isFree = action.kind === 'free'
  const price = isFree ? 0 : billingMonths === 3 ? action.plan.quarterlyPriceMmk : action.plan.monthlyPriceMmk
  const look = PLAN_LOOK[action.plan.code] ?? PLAN_LOOK.FREE

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isPending, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !isPending && onCancel()} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <img src={look.art} alt="" className="aspect-[2/1] w-full object-cover" />
        <div className="space-y-4 p-6">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#FCF7EE] px-2.5 py-1 text-xs font-semibold text-[#7A5418] dark:bg-amber-500/10 dark:text-amber-200">
            <FlaskConical className="size-3.5" aria-hidden />
            {t('agentDash.demoBadge')}
          </p>
          <h2 id={titleId} className="text-xl font-semibold tracking-tight">
            {isFree ? t('agentDash.demoReturnTitle') : t('agentDash.demoConfirmTitle', { plan: action.plan.name })}
          </h2>
          <dl className="space-y-1.5 rounded-xl bg-muted p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('agentDash.demoPlan')}</dt>
              <dd className="font-semibold">{action.plan.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('agentDash.billingPeriod')}</dt>
              <dd className="font-semibold">{isFree ? t('agentDash.freeForever') : billingMonths === 3 ? t('agentDash.threeMonths') : t('agentDash.monthly')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('agentDash.amount')}</dt>
              <dd className="font-semibold tabular-nums">{formatMmk(price)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{t('agentDash.demoNoCharge')}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isPending} autoFocus onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={isPending} onClick={onConfirm}>
              {isPending ? t('common.loading') : t('agentDash.demoConfirmButton')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AgentCheckoutPage() {
  const { t } = useTranslation()
  const { reference = '' } = useParams()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const orderQuery = useQuery({ queryKey: ['agent', 'order', reference], queryFn: async () => (await agentPlanApi.order(reference)).order, enabled: Boolean(reference) })
  const order = orderQuery.data

  const payMutation = useMutation({
    mutationFn: (outcome: 'success' | 'pending' | 'failed') => agentPlanApi.simulateDemoPayment(reference, outcome),
    onSuccess: async (result) => {
      setError(null)
      queryClient.setQueryData(['agent', 'order', reference], result.order)
      // Plan, limits and boosts may all have changed.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AGENT_DASHBOARD_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['agent', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['agent', 'boosts'] }),
        queryClient.invalidateQueries({ queryKey: ['agent', 'performance'] }),
      ])
    },
    onError: async (err) => {
      setError(err instanceof ApiRequestError ? err.message : t('agentDash.paymentFailed'))
      await orderQuery.refetch()
    },
  })

  if (!order) {
    return (
      <div className="space-y-4">
        <BackLink to="/agent/subscription" label={t('agentDash.nav.subscription')} />
        <QueryState isLoading={orderQuery.isLoading} isError={orderQuery.isError} onRetry={() => void orderQuery.refetch()} />
      </div>
    )
  }

  const backTo = order.kind === 'BOOST' ? '/agent/boosts' : '/agent/subscription'

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BackLink to={backTo} label={order.kind === 'BOOST' ? t('agentDash.nav.boosts') : t('agentDash.nav.subscription')} />

      {order.isDemo ? (
        <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-amber-500 bg-amber-500/10 p-4 text-sm" role="note">
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{t('agentDash.demoMode')}</p>
            <p>{t('agentDash.demoModeBody')}</p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{t('agentDash.checkout')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted-foreground">{t('agentDash.item')}</dt>
            <dd className="text-right font-medium">
              {order.kind === 'SUBSCRIPTION' ? `${order.plan?.name ?? ''} · ${t('agentDash.monthsCount', { count: order.billingMonths ?? 0 })}` : t('agentDash.boostDaysCount', { count: order.boostDays ?? 0 })}
            </dd>
            <dt className="text-muted-foreground">{t('agentDash.orderRef')}</dt>
            <dd className="text-right font-mono text-xs">{order.reference}</dd>
            <dt className="text-muted-foreground">{t('agentDash.status')}</dt>
            <dd className="text-right">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[order.status])}>{t(`agentDash.orderStatus.${order.status}`)}</span>
            </dd>
            <dt className="text-base font-semibold">{t('agentDash.amount')}</dt>
            <dd className="text-right text-base font-semibold tabular-nums">{formatMmk(order.amountMmk)}</dd>
          </dl>

          {error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {order.status === 'PENDING' && order.isDemo ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">{t('agentDash.simulatePrompt')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={payMutation.isPending} onClick={() => payMutation.mutate('success')}>
                  {t('agentDash.simulateSuccess')}
                </Button>
                <Button type="button" variant="outline" disabled={payMutation.isPending} onClick={() => payMutation.mutate('pending')}>
                  {t('agentDash.simulatePending')}
                </Button>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={payMutation.isPending} onClick={() => payMutation.mutate('failed')}>
                  {t('agentDash.simulateFailure')}
                </Button>
              </div>
              {payMutation.data?.status === 'PENDING' ? <p role="status">{t('agentDash.stillPending')}</p> : null}
            </div>
          ) : null}

          {order.status === 'PAID' ? (
            <div className="space-y-2" role="status">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">{order.kind === 'BOOST' ? t('agentDash.boostActivated') : t('agentDash.planActivated')}</p>
              <Button asChild>
                <Link to={order.kind === 'BOOST' ? '/agent/boosts' : '/agent/dashboard'}>{t('agentDash.continue')}</Link>
              </Button>
            </div>
          ) : null}

          {order.status === 'FAILED' || order.status === 'EXPIRED' ? (
            <div className="space-y-2" role="status">
              <p className="text-destructive">{order.status === 'FAILED' ? t('agentDash.orderFailedNote') : t('agentDash.orderExpiredNote')}</p>
              <Button asChild variant="outline">
                <Link to={backTo}>{t('agentDash.startAgain')}</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
