import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, FlaskConical, Minus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { marketplaceApi } from '../api/marketplace-api'
import { MarketplaceDialog } from '../components/MarketplaceDialog'
import { formatDate, formatPrice } from '../lib/marketplace-format'
import type { SellerOrder, SellerPlan } from '../types'

export const SELLER_SUBSCRIPTION_QUERY_KEY = ['marketplace', 'my-subscription'] as const

type Cell = { included: boolean; text?: string }

/** Every comparison row is derived from the plan catalogue the server returns. */
function useComparisonRows() {
  const { t } = useTranslation()
  return [
    { label: t('sellerPlans.rows.price'), cell: (plan: SellerPlan): Cell => ({ included: true, text: formatPrice(plan.monthlyPriceMmk) }) },
    {
      label: t('sellerPlans.rows.listings'),
      cell: (plan: SellerPlan): Cell => ({
        included: true,
        text: plan.activeListingLimit === null ? t('sellerPlans.unlimited') : t('sellerPlans.upTo', { count: plan.activeListingLimit }),
      }),
    },
    { label: t('sellerPlans.rows.visibility'), cell: (): Cell => ({ included: true }) },
    { label: t('sellerPlans.rows.featured'), cell: (plan: SellerPlan): Cell => ({ included: plan.homepageFeatured }) },
    {
      label: t('sellerPlans.rows.freeBoost'),
      cell: (plan: SellerPlan): Cell => ({ included: plan.freeBoostDays > 0, text: plan.freeBoostDays > 0 ? t('sellerPlans.days', { count: plan.freeBoostDays }) : undefined }),
    },
    {
      label: t('sellerPlans.rows.views'),
      cell: (plan: SellerPlan): Cell => ({ included: true, text: plan.insightsLevel === 'DETAILED' ? t('sellerPlans.detailed') : t('sellerPlans.basic') }),
    },
    { label: t('sellerPlans.rows.inquiries'), cell: (): Cell => ({ included: true }) },
    { label: t('sellerPlans.rows.manage'), cell: (): Cell => ({ included: true }) },
    { label: t('sellerPlans.rows.badge'), cell: (plan: SellerPlan): Cell => ({ included: plan.premiumBadge }) },
    {
      label: t('sellerPlans.rows.subscription'),
      cell: (plan: SellerPlan): Cell => ({ included: true, text: plan.monthlyPriceMmk > 0 ? t('sellerPlans.fullManagement') : t('sellerPlans.basicStatus') }),
    },
  ]
}

function CellValue({ cell }: { cell: Cell }) {
  const { t } = useTranslation()
  if (!cell.included) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="size-4" aria-hidden />
        <span className="sr-only">{t('sellerPlans.notIncluded')}</span>
      </span>
    )
  }
  return cell.text ? (
    <span className="font-medium">{cell.text}</span>
  ) : (
    <span className="inline-flex items-center text-success">
      <Check className="size-4" aria-hidden />
      <span className="sr-only">{t('sellerPlans.included')}</span>
    </span>
  )
}

function planBenefits(plan: SellerPlan, t: (key: string, options?: Record<string, unknown>) => string): string[] {
  const items = [plan.activeListingLimit === null ? t('sellerPlans.benefit.unlimited') : t('sellerPlans.benefit.limited', { count: plan.activeListingLimit })]
  if (!plan.homepageFeatured) items.push(t('sellerPlans.benefit.standardVisibility'))
  if (plan.premiumBadge) items.push(t('sellerPlans.benefit.badge'))
  if (plan.homepageFeatured) items.push(t('sellerPlans.benefit.featured'))
  if (plan.freeBoostDays > 0) items.push(t('sellerPlans.benefit.freeBoost', { count: plan.freeBoostDays }))
  if (plan.insightsLevel === 'DETAILED') {
    items.push(t('sellerPlans.benefit.detailedInsights'), t('sellerPlans.benefit.inquiryManagement'))
  } else {
    items.push(t('sellerPlans.benefit.inquiries'), t('sellerPlans.benefit.basicViews'), t('sellerPlans.benefit.manage'))
  }
  return items
}

/** Free Seller / Premium Seller cards and the comparison table, shown on My Marketplace > Seller Plans. */
export function SellerPlanComparison({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [confirming, setConfirming] = useState<SellerPlan | null>(null)
  const rows = useComparisonRows()

  const plansQuery = useQuery({ queryKey: ['marketplace', 'seller-plans'], queryFn: () => marketplaceApi.sellerPlans() })
  const subscriptionQuery = useQuery({ queryKey: SELLER_SUBSCRIPTION_QUERY_KEY, enabled: isAuthenticated, queryFn: () => marketplaceApi.mySubscription() })

  const orderMutation = useMutation({
    mutationFn: (plan: SellerPlan) => marketplaceApi.createSubscriptionOrder(plan.code),
    onSuccess: ({ order }) => navigate(`/marketplace/checkout/${order.reference}`),
  })

  // Wait for the seller's own plan too, so a Premium seller never briefly sees "Upgrade".
  if (plansQuery.isLoading || subscriptionQuery.isLoading) return <LoadingState />
  if (plansQuery.isError || !plansQuery.data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{t('marketplace.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void plansQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const plans = plansQuery.data.plans
  const current = subscriptionQuery.data
  const currentCode = current?.plan.code
  const demoPayments = plansQuery.data.demoPayments

  const onChoose = (plan: SellerPlan) => {
    if (!isAuthenticated) {
      navigate('/sign-in', { state: { from: '/marketplace/my/plans' } })
      return
    }
    if (plan.monthlyPriceMmk === 0) {
      navigate('/marketplace/my')
      return
    }
    orderMutation.reset()
    setConfirming(plan)
  }

  return (
    <div className="space-y-6">
      {demoPayments ? (
        <p className="flex items-start gap-2 rounded-xl border-2 border-dashed border-gold/60 bg-gold-soft p-3 text-sm font-medium text-gold-ink" role="note">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('sellerPlans.demoNote')}
        </p>
      ) : (
        <p className="rounded-xl border bg-muted/40 p-3 text-sm" role="note">
          {t('sellerPlans.paymentsUnavailable')}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = currentCode === plan.code
          const isPaid = plan.monthlyPriceMmk > 0
          return (
            <Card key={plan.code} className={cn('flex flex-col', isPaid && 'border-2 border-brand-sky', isCurrent && 'ring-2 ring-success')}>
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {isCurrent ? (
                    <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-ink">{t('sellerPlans.currentPlan')}</span>
                  ) : isPaid ? (
                    <span className="rounded-full bg-brand-sky-soft px-2.5 py-0.5 text-xs font-semibold text-brand-sky-strong">{t('sellerPlans.popular')}</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{t('sellerPlans.free')}</span>
                  )}
                </div>
                <p>
                  <span className={cn('text-3xl font-bold tabular-nums', isPaid && 'text-brand-sky-strong')}>{formatPrice(plan.monthlyPriceMmk)}</span>
                  <span className="text-sm text-muted-foreground"> {t('sellerPlans.perMonth')}</span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex-1 space-y-2 border-t pt-4 text-sm">
                  {planBenefits(plan, t).map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {benefit}
                    </li>
                  ))}
                </ul>
                {isCurrent && isPaid && current?.subscription ? (
                  <p className="text-xs text-muted-foreground">{t('sellerPlans.activeUntil', { date: formatDate(current.subscription.endsAt) })}</p>
                ) : null}
                <Button
                  type="button"
                  variant={isPaid ? 'cta' : 'outline'}
                  className="w-full"
                  // Without a payment provider or the Marketplace demo checkout, paid plans cannot be bought.
                  disabled={(isCurrent && !isPaid) || Boolean(isCurrent && current?.renewal) || (isPaid && !demoPayments)}
                  onClick={() => onChoose(plan)}
                >
                  {isCurrent
                    ? isPaid
                      ? current?.renewal
                        ? t('sellerPlans.renewalQueued')
                        : t('sellerPlans.renew')
                      : t('sellerPlans.currentPlan')
                    : isPaid
                      ? demoPayments
                        ? t('sellerPlans.activateDemo')
                        : t('sellerPlans.upgrade')
                      : t('sellerPlans.startFree')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!compact ? (
        <section className="space-y-3" aria-labelledby="plan-compare-title">
          <h2 id="plan-compare-title" className="text-xl font-semibold">
            {t('sellerPlans.compareTitle')}
          </h2>
          <div className="relative overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="p-3 text-left font-semibold">
                    {t('sellerPlans.feature')}
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.code} scope="col" className="p-3 text-center font-semibold">
                      {plan.name}
                      {currentCode === plan.code ? <span className="block text-xs font-normal text-success-ink">{t('sellerPlans.currentPlan')}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="p-3 text-left font-normal">
                      {row.label}
                    </th>
                    {plans.map((plan) => (
                      <td key={plan.code} className="p-3 text-center">
                        <CellValue cell={row.cell(plan)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <MarketplaceDialog
        open={Boolean(confirming)}
        title={demoPayments ? t('sellerPlans.confirmDemoTitle', { plan: confirming?.name ?? '' }) : t('sellerPlans.confirmTitle', { plan: confirming?.name ?? '' })}
        description={t('sellerPlans.confirmBody', { plan: confirming?.name ?? '', price: formatPrice(confirming?.monthlyPriceMmk ?? 0) })}
        busy={orderMutation.isPending}
        onDismiss={() => setConfirming(null)}
      >
        {demoPayments ? <p className="mb-3 text-xs text-muted-foreground">{t('sellerPlans.demoNoCharge')}</p> : null}
        {orderMutation.isError ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {orderMutation.error instanceof ApiRequestError ? orderMutation.error.message : t('sellerPlans.orderError')}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={orderMutation.isPending} onClick={() => setConfirming(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={orderMutation.isPending} onClick={() => confirming && orderMutation.mutate(confirming)}>
            {orderMutation.isPending ? t('common.loading') : demoPayments ? t('sellerPlans.continueToDemo') : t('sellerPlans.continueToPayment')}
          </Button>
        </div>
      </MarketplaceDialog>
    </div>
  )
}

const STATUS_TONE: Record<SellerOrder['status'], string> = {
  PENDING: 'bg-warning-soft text-warning',
  PAID: 'bg-success-soft text-success-ink',
  FAILED: 'bg-danger-soft text-destructive',
  EXPIRED: 'bg-muted text-muted-foreground',
}

/** Checkout for a seller plan or product boost. Only the demo provider exists today. */
export function SellerCheckoutPage() {
  const { t } = useTranslation()
  const { reference = '' } = useParams()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  const orderQuery = useQuery({
    queryKey: ['marketplace', 'order', reference],
    enabled: Boolean(reference) && isAuthenticated,
    queryFn: async () => (await marketplaceApi.getOrder(reference)).order,
  })
  const order = orderQuery.data
  const subscriptionQuery = useQuery({
    queryKey: SELLER_SUBSCRIPTION_QUERY_KEY,
    enabled: order?.status === 'PAID' && order.kind === 'SELLER_SUBSCRIPTION',
    queryFn: () => marketplaceApi.mySubscription(),
  })

  const payMutation = useMutation({
    mutationFn: (outcome: 'SUCCESS' | 'PENDING' | 'FAILED') => marketplaceApi.simulateDemoPayment(reference, outcome),
    onSuccess: async (result) => {
      queryClient.setQueryData(['marketplace', 'order', reference], result.order)
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] })
    },
    onError: () => void orderQuery.refetch(),
  })

  if (!order) {
    return (
      <div className="space-y-3">
        <BackButton fallback="/marketplace/my" />
        {orderQuery.isError ? <p className="text-sm text-destructive">{t('sellerPlans.orderNotFound')}</p> : <LoadingState />}
      </div>
    )
  }

  const isBoost = order.kind === 'LISTING_BOOST'
  const doneLink = isBoost ? '/marketplace/my/boosts' : '/marketplace/my/subscription'

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BackButton fallback={doneLink} />

      {order.isDemo ? (
        <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-gold/60 bg-gold-soft p-4 text-sm text-gold-ink" role="note">
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{t('sellerPlans.demoTransaction')}</p>
            <p>{t('sellerPlans.demoTransactionBody')}</p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{t('sellerPlans.checkout')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted-foreground">{t('sellerPlans.item')}</dt>
            <dd className="text-right font-medium">
              {isBoost ? t('sellerPlans.boostItem', { count: order.boostDays ?? 0 }) : t('sellerPlans.planItem', { plan: order.plan?.name ?? '' })}
            </dd>
            <dt className="text-muted-foreground">{t('sellerPlans.reference')}</dt>
            <dd className="text-right font-mono text-xs">{order.reference}</dd>
            <dt className="text-muted-foreground">{t('sellerPlans.status')}</dt>
            <dd className="text-right">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[order.status])}>{t(`sellerPlans.orderStatus.${order.status}`)}</span>
            </dd>
            <dt className="text-base font-semibold">{t('sellerPlans.amount')}</dt>
            <dd className="text-right text-base font-semibold tabular-nums">{formatPrice(order.amountMmk)}</dd>
          </dl>

          {payMutation.isError ? (
            <p className="text-destructive" role="alert">
              {payMutation.error instanceof ApiRequestError ? payMutation.error.message : t('sellerPlans.paymentError')}
            </p>
          ) : null}

          {order.status === 'PENDING' && order.isDemo ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">{t('sellerPlans.simulatePrompt')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={payMutation.isPending} onClick={() => payMutation.mutate('SUCCESS')}>
                  {t('sellerPlans.simulateSuccess')}
                </Button>
                <Button type="button" variant="outline" disabled={payMutation.isPending} onClick={() => payMutation.mutate('PENDING')}>
                  {t('sellerPlans.simulatePending')}
                </Button>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={payMutation.isPending} onClick={() => payMutation.mutate('FAILED')}>
                  {t('sellerPlans.simulateFailure')}
                </Button>
              </div>
              {payMutation.data?.status === 'PENDING' ? <p role="status">{t('sellerPlans.stillPending')}</p> : null}
            </div>
          ) : null}

          {order.status === 'PENDING' && !order.isDemo ? <p className="text-muted-foreground">{t('sellerPlans.awaitingProvider')}</p> : null}

          {order.status === 'PAID' ? (
            <div className="space-y-2" role="status">
              <p className="font-medium text-success-ink">{isBoost ? t('sellerPlans.boostActivated') : t('sellerPlans.planActivated')}</p>
              {!isBoost && subscriptionQuery.data?.subscription ? (
                <p className="text-sm">
                  {t('sellerPlans.activeDetails', {
                    plan: subscriptionQuery.data.plan.name,
                    from: formatDate(subscriptionQuery.data.subscription.startsAt),
                    to: formatDate(subscriptionQuery.data.subscription.endsAt),
                  })}
                </p>
              ) : null}
              <Button asChild>
                <Link to={doneLink}>{t('sellerPlans.backToDashboard')}</Link>
              </Button>
            </div>
          ) : null}

          {order.status === 'FAILED' || order.status === 'EXPIRED' ? (
            <div className="space-y-2" role="status">
              <p className="text-destructive">{order.status === 'FAILED' ? t('sellerPlans.failedNote') : t('sellerPlans.expiredNote')}</p>
              <Button asChild variant="outline">
                <Link to={doneLink}>{t('sellerPlans.startAgain')}</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
