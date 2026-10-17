import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, FlaskConical, Gift, Rocket } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName, textareaClassName } from '@/components/ui/field-styles'
import { ErrorState, LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { marketplaceApi } from '../api/marketplace-api'
import { formatDate, formatPrice } from '../lib/marketplace-format'
import { SELLER_SUBSCRIPTION_QUERY_KEY } from '../pages/SellerPlansPages'
import type { BoostStatus, InquiryStatus, MyListing, SellerInquiry, SellerInsights } from '../types'

function SectionState({ isLoading, isError, onRetry }: { isLoading: boolean; isError: boolean; onRetry: () => void }) {
  const { t } = useTranslation()
  if (isLoading) return <LoadingState />
  if (!isError) return null
  return <ErrorState message={t('marketplace.loadError')} onRetry={onRetry} />
}

export const BOOST_TONE: Record<BoostStatus, string> = {
  ACTIVE: 'bg-cta-soft text-cta-soft-foreground',
  SCHEDULED: 'bg-info-soft text-info',
  PAUSED: 'bg-muted text-muted-foreground',
  ENDED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
}

// --- Buyer Inquiries ---

const INQUIRY_TONE: Record<InquiryStatus, string> = {
  NEW: 'bg-info-soft text-info',
  REPLIED: 'bg-success-soft text-success-ink',
  CLOSED: 'bg-muted text-muted-foreground',
}

function InquiryItem({ inquiry }: { inquiry: SellerInquiry }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: (input: { status?: InquiryStatus; reply?: string; read?: boolean }) => marketplaceApi.updateInquiry(inquiry.id, input),
    onSuccess: async () => {
      setReply('')
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] })
    },
  })

  return (
    <li className={cn('space-y-2 p-4', !inquiry.read && 'bg-info-soft/60')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/marketplace/items/${inquiry.listing.id}`} className="font-medium hover:underline">
            {inquiry.listing.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {inquiry.buyer.name} · {formatDate(inquiry.updatedAt)}
            {!inquiry.read ? <span className="ml-1 font-semibold text-info">· {t('sellerDash.inquiries.unread')}</span> : null}
          </p>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', INQUIRY_TONE[inquiry.status])}>{t(`sellerDash.inquiries.status.${inquiry.status}`)}</span>
      </div>
      <p className="whitespace-pre-line text-sm">{inquiry.message}</p>
      {inquiry.sellerReply ? (
        <p className="rounded-lg bg-muted/60 p-2 text-sm">
          <span className="font-medium">{t('sellerDash.inquiries.yourReply')}:</span> {inquiry.sellerReply}
        </p>
      ) : null}
      {open ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (reply.trim()) mutation.mutate({ reply: reply.trim() })
          }}
        >
          <textarea
            className={textareaClassName}
            maxLength={1000}
            aria-label={t('sellerDash.inquiries.replyLabel')}
            placeholder={t('sellerDash.inquiries.replyPlaceholder')}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!reply.trim() || mutation.isPending}>
              {t('sellerDash.inquiries.sendReply')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {inquiry.status !== 'CLOSED' ? (
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              {t('sellerDash.inquiries.reply')}
            </Button>
          ) : null}
          {!inquiry.read ? (
            <Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ read: true })}>
              {t('sellerDash.inquiries.markRead')}
            </Button>
          ) : null}
          {inquiry.status !== 'CLOSED' ? (
            <Button type="button" size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ status: 'CLOSED' })}>
              {t('sellerDash.inquiries.close')}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ status: 'NEW' })}>
              {t('sellerDash.inquiries.reopen')}
            </Button>
          )}
        </div>
      )}
      {mutation.isError ? (
        <p className="text-xs text-destructive" role="alert">
          {mutation.error instanceof ApiRequestError ? mutation.error.message : t('marketplace.sell.saveError')}
        </p>
      ) : null}
    </li>
  )
}

export function InquiriesSection() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<InquiryStatus | 'ALL'>('ALL')
  const query = useQuery({
    queryKey: ['marketplace', 'inquiries', status],
    queryFn: () => marketplaceApi.inquiries(status === 'ALL' ? undefined : status),
  })

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>{t('sellerDash.sections.inquiries')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('sellerDash.inquiries.subtitle')}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('sellerDash.inquiries.filter')}>
          {(['ALL', 'NEW', 'REPLIED', 'CLOSED'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm', status === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setStatus(value)}
            >
              {value === 'ALL' ? t('marketplace.my.all') : t(`sellerDash.inquiries.status.${value}`)}
              {value !== 'ALL' && query.data ? ` (${query.data.counts[value]})` : ''}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-6 pb-4">
          <SectionState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
        </div>
        {query.data && query.data.items.length === 0 ? <p className="px-6 pb-6 text-sm text-muted-foreground">{t('sellerDash.inquiries.empty')}</p> : null}
        {query.data && query.data.items.length > 0 ? (
          <ul className="divide-y border-t">
            {query.data.items.map((inquiry) => (
              <InquiryItem key={inquiry.id} inquiry={inquiry} />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

// --- Product Insights ---

function TrendChart({ series }: { series: NonNullable<SellerInsights['series']> }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...series.map((point) => point.views ?? 0))
  return (
    <div className="space-y-2">
      <div className="flex h-36 items-end gap-[2px]" role="img" aria-label={t('sellerDash.insights.chartLabel')}>
        {series.map((point) => (
          <div
            key={point.day}
            className="group relative flex h-full flex-1 items-end"
            title={point.views === null ? `${point.day}: ${t('sellerDash.insights.noData')}` : `${point.day}: ${t('sellerDash.insights.viewsCount', { count: point.views })}, ${t('sellerDash.insights.inquiriesCount', { count: point.inquiries ?? 0 })}`}
          >
            {point.views === null ? (
              <div className="h-full w-full rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_6px)]" />
            ) : (
              <div className="w-full rounded-t-sm bg-brand-sky" style={{ height: `${Math.max(2, (point.views / max) * 100)}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{series[0]?.day}</span>
        <span>{series.at(-1)?.day}</span>
      </div>
      <p className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded-sm bg-brand-sky" aria-hidden /> {t('sellerDash.insights.views')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,var(--muted-foreground)_2px,var(--muted-foreground)_3px)]" aria-hidden />
          {t('sellerDash.insights.noData')}
        </span>
      </p>
    </div>
  )
}

export function InsightsSection({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation()
  const [days, setDays] = useState(7)
  const query = useQuery({ queryKey: ['marketplace', 'insights', days], queryFn: () => marketplaceApi.insights(days) })
  const insights = query.data?.insights

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>{t('sellerDash.sections.insights')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('sellerDash.insights.subtitle')}</p>
        </div>
        {insights && insights.availableRanges.length > 1 ? (
          <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('sellerDash.insights.range')}>
            {insights.availableRanges.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={insights.days === value}
                className={cn('rounded-md px-2.5 py-1 text-sm font-medium', insights.days === value ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                onClick={() => setDays(value)}
              >
                {t('sellerDash.insights.days', { count: value })}
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <SectionState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
        {insights ? (
          <>
            <dl className="grid grid-cols-3 gap-3">
              {[
                { label: t('sellerDash.insights.viewsInRange', { count: insights.days }), value: insights.totals.views },
                { label: t('sellerDash.insights.inquiriesInRange', { count: insights.days }), value: insights.totals.inquiries },
                { label: t('sellerDash.insights.allTimeViews'), value: insights.totals.allTimeViews },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border p-3">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              {insights.trackingSince ? t('sellerDash.insights.trackingSince', { date: insights.trackingSince }) : t('sellerDash.insights.noTrackingYet')}{' '}
              {t('sellerDash.insights.definition')}
            </p>

            {insights.series ? (
              <TrendChart series={insights.series} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4 text-sm">
                <p>{t('sellerDash.insights.basicNote')}</p>
                <Button type="button" size="sm" onClick={onUpgrade}>
                  <Crown aria-hidden />
                  {t('sellerPlans.upgrade')}
                </Button>
              </div>
            )}

            {insights.bestPerforming && insights.bestPerforming.length > 0 ? (
              <section className="space-y-2">
                <h3 className="font-semibold">{t('sellerDash.insights.best')}</h3>
                <ol className="space-y-1 text-sm">
                  {insights.bestPerforming.map((item, index) => (
                    <li key={item.listing.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {index + 1}. {item.listing.title}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {t('sellerDash.insights.viewsCount', { count: item.views })} · {t('sellerDash.insights.inquiriesCount', { count: item.inquiries })}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="font-semibold">{t('sellerDash.insights.perProduct')}</h3>
              {insights.products.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('marketplace.my.empty')}</p>
              ) : (
                <div className="relative overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[26rem] text-sm">
                    <thead className="bg-muted/60 text-left">
                      <tr>
                        <th className="p-2 font-semibold">{t('sellerDash.insights.product')}</th>
                        <th className="p-2 text-right font-semibold">{t('sellerDash.insights.viewsInRange', { count: insights.days })}</th>
                        <th className="p-2 text-right font-semibold">{t('sellerDash.insights.inquiriesInRange', { count: insights.days })}</th>
                        {insights.level === 'DETAILED' ? <th className="p-2 text-right font-semibold">{t('sellerDash.insights.rate')}</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {insights.products.map((item) => (
                        <tr key={item.listing.id}>
                          <td className="max-w-[14rem] truncate p-2">{item.listing.title}</td>
                          <td className="p-2 text-right tabular-nums">{item.views}</td>
                          <td className="p-2 text-right tabular-nums">{item.inquiries}</td>
                          {insights.level === 'DETAILED' ? <td className="p-2 text-right tabular-nums">{item.inquiryRate === null ? '—' : `${item.inquiryRate}%`}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

// --- Boost Products ---

export function BoostSection({ listings }: { listings: MyListing[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [days, setDays] = useState<Record<string, number>>({})
  const query = useQuery({ queryKey: ['marketplace', 'boosts'], queryFn: () => marketplaceApi.boosts() })

  const orderMutation = useMutation({
    mutationFn: (input: { listingId: string; days: number }) => marketplaceApi.createBoostOrder(input.listingId, input.days),
    onSuccess: ({ order }) => navigate(`/marketplace/checkout/${order.reference}`),
  })
  const freeMutation = useMutation({
    mutationFn: (listingId: string) => marketplaceApi.claimFreeBoost(listingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  })

  const data = query.data
  const eligible = listings.filter((listing) => listing.status === 'ACTIVE' && listing.moderationStatus === 'APPROVED')
  const error = orderMutation.error ?? freeMutation.error

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('sellerDash.sections.boost')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('sellerDash.boost.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SectionState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
          {data ? (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                {data.options.map((option) => (
                  <span key={option.days} className="rounded-full border px-3 py-1">
                    {t('sellerDash.boost.option', { count: option.days, price: formatPrice(option.priceMmk) })}
                  </span>
                ))}
              </div>
              <div
                className={cn(
                  'flex items-start gap-2 rounded-xl border p-3 text-sm',
                  data.freeBoost.available ? 'border-success/30 bg-success-soft' : 'bg-muted/40',
                )}
              >
                <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  {data.freeBoost.days === 0
                    ? t('sellerDash.boost.freeLocked')
                    : data.freeBoost.available
                      ? t('sellerDash.boost.freeAvailable', { count: data.freeBoost.days, date: formatDate(data.freeBoost.expiresAt) })
                      : t('sellerDash.boost.freeUsed')}
                </p>
              </div>
              {data.demoPayments ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FlaskConical className="size-3.5" aria-hidden /> {t('sellerDash.boost.demoNote')}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error instanceof ApiRequestError ? error.message : t('sellerPlans.orderError')}
                </p>
              ) : null}

              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('sellerDash.boost.noEligible')}</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {eligible.map((listing) => {
                    const chosen = days[listing.id] ?? data.options[0]?.days ?? 3
                    const price = data.options.find((option) => option.days === chosen)?.priceMmk ?? 0
                    return (
                      <li key={listing.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{listing.title}</p>
                          {listing.boost ? (
                            <p className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className={cn('rounded-full px-2 py-0.5 font-semibold', BOOST_TONE[listing.boost.status])}>{t(`sellerDash.boost.status.${listing.boost.status}`)}</span>
                              <span className="text-muted-foreground">
                                {formatDate(listing.boost.startsAt)} – {formatDate(listing.boost.endsAt)}
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t('sellerDash.boost.notBoosted')}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {data.freeBoost.available ? t('sellerDash.boost.eligibleFree') : t('sellerDash.boost.eligiblePaid')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {data.freeBoost.available ? (
                            <Button type="button" size="sm" variant="outline" disabled={freeMutation.isPending} onClick={() => freeMutation.mutate(listing.id)}>
                              <Gift aria-hidden />
                              {t('sellerDash.boost.useFree', { count: data.freeBoost.days })}
                            </Button>
                          ) : null}
                          <label className="sr-only" htmlFor={`boost-days-${listing.id}`}>
                            {t('sellerDash.boost.duration')}
                          </label>
                          <select
                            id={`boost-days-${listing.id}`}
                            className={cn(selectClassName, 'h-control-sm w-auto px-2')}
                            value={chosen}
                            onChange={(event) => setDays((previous) => ({ ...previous, [listing.id]: Number(event.target.value) }))}
                          >
                            {data.options.map((option) => (
                              <option key={option.days} value={option.days}>
                                {t('sellerDash.insights.days', { count: option.days })}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="cta"
                            disabled={orderMutation.isPending}
                            onClick={() => orderMutation.mutate({ listingId: listing.id, days: chosen })}
                          >
                            <Rocket aria-hidden />
                            {t('sellerDash.boost.boostFor', { price: formatPrice(price) })}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {data && data.items.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('sellerDash.boost.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.items.map((boost) => (
                <li key={boost.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{boost.listing.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {boost.source === 'FREE_ENTITLEMENT' ? t('sellerDash.boost.sourceFree') : t('sellerDash.boost.sourcePaid')}
                    {' · '}
                    {formatDate(boost.startsAt)} – {formatDate(boost.endsAt)}
                    <span className={cn('rounded-full px-2 py-0.5 font-semibold', BOOST_TONE[boost.status])}>{t(`sellerDash.boost.status.${boost.status}`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// --- Seller Subscription ---

export function SubscriptionSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: SELLER_SUBSCRIPTION_QUERY_KEY, queryFn: () => marketplaceApi.mySubscription() })
  const resetMutation = useMutation({
    mutationFn: () => marketplaceApi.resetDemoSubscription(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  })
  const state = query.data

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('sellerDash.sections.subscription')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SectionState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
          {state ? (
            <>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 border-b pb-2 sm:block sm:border-0">
                  <dt className="text-muted-foreground">{t('sellerDash.subscription.plan')}</dt>
                  <dd className="font-semibold">{state.plan.name}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b pb-2 sm:block sm:border-0">
                  <dt className="text-muted-foreground">{t('sellerDash.subscription.status')}</dt>
                  <dd className="font-semibold">{t(`sellerDash.subscription.statusValue.${state.status}`)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b pb-2 sm:block sm:border-0">
                  <dt className="text-muted-foreground">{t('sellerDash.subscription.price')}</dt>
                  <dd className="font-semibold">
                    {formatPrice(state.plan.monthlyPriceMmk)} {t('sellerPlans.perMonth')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b pb-2 sm:block sm:border-0">
                  <dt className="text-muted-foreground">{t('sellerDash.subscription.activated')}</dt>
                  <dd className="font-semibold">{state.subscription ? formatDate(state.subscription.startsAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b pb-2 sm:block sm:border-0">
                  <dt className="text-muted-foreground">{t('sellerDash.subscription.expires')}</dt>
                  <dd className="font-semibold">{state.subscription ? formatDate(state.subscription.endsAt) : t('sellerDash.subscription.noExpiry')}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b pb-2 sm:block sm:border-0">
                  <dt className="text-muted-foreground">{t('sellerDash.subscription.renewal')}</dt>
                  <dd className="font-semibold">
                    {state.renewal ? t('sellerDash.subscription.renewalQueued', { date: formatDate(state.renewal.endsAt) }) : state.subscription ? t('sellerDash.subscription.renewManually') : '—'}
                  </dd>
                </div>
              </dl>
              {state.status === 'EXPIRED' ? <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">{t('sellerDash.subscription.expiredNote')}</p> : null}
              {state.demoPayments && state.subscription ? (
                <Button type="button" variant="outline" size="sm" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
                  <FlaskConical aria-hidden />
                  {t('sellerDash.subscription.demoReset')}
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link to="/marketplace/my/plans">{t('sellerDash.subscription.compareLink')}</Link>
      </Button>
    </div>
  )
}
