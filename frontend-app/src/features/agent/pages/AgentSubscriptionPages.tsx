import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { agentPlanApi, formatDate, formatMmk, type PaymentOrder, type Plan } from '../api/agent-plan-api'
import { PageHeading, QueryState } from '../components/dashboard-parts'
import { AGENT_DASHBOARD_QUERY_KEY, useAgentDashboard } from '../layout/AgentDashboardLayout'

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
  const navigate = useNavigate()
  const dashboardQuery = useAgentDashboard()
  const dashboard = dashboardQuery.data
  const [billingMonths, setBillingMonths] = useState<1 | 3>(1)
  const [error, setError] = useState<string | null>(null)

  const ordersQuery = useQuery({ queryKey: ['agent', 'orders'], queryFn: async () => (await agentPlanApi.orders()).items })

  const orderMutation = useMutation({
    mutationFn: (plan: Plan) => agentPlanApi.createSubscriptionOrder(plan.code, billingMonths),
    onSuccess: ({ order }) => navigate(`/agent/checkout/${order.reference}`),
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : t('agentDash.orderFailed')),
  })

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.subscription')} />
        <QueryState isLoading={dashboardQuery.isLoading} isError={dashboardQuery.isError} onRetry={() => void dashboardQuery.refetch()} />
      </div>
    )
  }

  const current = dashboard.plan
  const isActive = dashboard.subscription.status === 'ACTIVE'

  return (
    <div className="space-y-6">
      <PageHeading title={t('agentDash.nav.subscription')} subtitle={t('agentDash.subscriptionSubtitle')} />

      <div className="rounded-xl border bg-card p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{t('agentDash.currentPlan')}: </span>
          <span className="font-semibold">{current.name}</span>
          {isActive ? ` · ${t('agentDash.validUntil', { date: formatDate(dashboard.subscription.endsAt) })}` : ''}
        </p>
        {dashboard.subscription.status === 'EXPIRED' ? <p className="mt-1 text-destructive">{t('agentDash.expiredNotice')}</p> : null}
      </div>

      {!dashboard.demoPayments ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status">
          {t('agentDash.paymentsUnavailable')}
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

      <div className="grid gap-4 lg:grid-cols-3">
        {dashboard.plans.map((plan) => {
          const price = billingMonths === 3 ? plan.quarterlyPriceMmk : plan.monthlyPriceMmk
          const isCurrent = plan.code === current.code
          const isLower = isActive && plan.rank < current.rank
          const isFree = plan.code === 'FREE'
          return (
            <Card key={plan.code} className={cn(isCurrent && 'border-primary ring-1 ring-primary')}>
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
              <CardContent className="space-y-4 text-sm">
                <ul className="space-y-1.5">
                  {planFeatures(plan, t).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isFree ? null : isLower ? (
                  <p className="text-xs text-muted-foreground">{t('agentDash.downgradeNote')}</p>
                ) : (
                  <Button type="button" className="w-full" disabled={orderMutation.isPending || !dashboard.demoPayments} onClick={() => { setError(null); orderMutation.mutate(plan) }}>
                    {isCurrent && isActive ? t('agentDash.renew') : t('agentDash.choosePlan', { plan: plan.name })}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('agentDash.planRules')}</p>

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
