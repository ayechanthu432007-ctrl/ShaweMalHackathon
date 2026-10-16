import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Box, CheckCircle2, Crown, Eye, Heart, MessageSquare, PackagePlus, Pencil, RotateCcw, Search, Trash2, TrendingUp, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { marketplaceApi } from '../api/marketplace-api'
import { ListingCard, ListingGrid, ListingStatusBadge } from '../components/ListingCard'
import { MarketplaceDialog } from '../components/MarketplaceDialog'
import { MarkSoldDialog } from '../components/MarkSoldDialog'
import { MovingOutSaleDialog } from '../components/MovingOutSaleDialog'
import { BOOST_TONE, BoostSection, InquiriesSection, InsightsSection, SubscriptionSection } from '../components/SellerDashboardSections'
import { SellerBadges } from '../components/SellerBadges'
import { useSellerStatus } from '../hooks/useMarketplaceData'
import { formatDate } from '../lib/marketplace-format'
import type { ListingAllowance, ListingStatus, MyListing, MyMovingOutSale } from '../types'

const MODERATION_TONE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  REJECTED: 'bg-destructive/10 text-destructive',
  REMOVED: 'bg-destructive/10 text-destructive',
}

const SECTIONS = [
  { id: 'products', icon: Box },
  { id: 'inquiries', icon: MessageSquare },
  { id: 'insights', icon: BarChart3 },
  { id: 'boost', icon: TrendingUp },
  { id: 'subscription', icon: CheckCircle2 },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

/** Active products against the plan's limit; Premium shows "unlimited". */
export function ListingAllowanceMeter({ allowance, className }: { allowance: ListingAllowance; className?: string }) {
  const { t } = useTranslation()
  if (allowance.limit === null) {
    return (
      <p className={cn('rounded-xl border bg-card p-4 text-sm', className)} role="status">
        <span className="font-semibold">{t('sellerDash.allowance.unlimited', { used: allowance.used })}</span>
      </p>
    )
  }
  const full = (allowance.remaining ?? 0) <= 0
  const percent = Math.min(100, Math.round((allowance.used / Math.max(1, allowance.limit)) * 100))
  return (
    <div className={cn('rounded-xl border bg-card p-4', full && 'border-amber-500/50 bg-amber-500/5', className)} role="status">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-semibold">{t('sellerDash.allowance.used', { used: allowance.used, limit: allowance.limit })}</p>
        <p className={cn('text-muted-foreground', full && 'font-medium text-amber-700 dark:text-amber-300')}>
          {full ? t('sellerDash.allowance.full') : t('sellerDash.allowance.remaining', { count: allowance.remaining ?? 0 })}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn('h-full rounded-full transition-all', full ? 'bg-amber-500' : 'bg-button')} style={{ width: `${percent}%` }} />
      </div>
      {full ? (
        <Button asChild size="sm" className="mt-3 bg-[#FFDE59] text-[#3d2f00] hover:bg-[#f5d03f]">
          <Link to="/marketplace/plans">
            <Crown aria-hidden />
            {t('sellerPlans.upgrade')}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

function MyListingFooter({
  listing,
  onMarkSold,
  onDelete,
}: {
  listing: MyListing
  onMarkSold: (listing: MyListing) => void
  onDelete: (listing: MyListing) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const reactivateMutation = useMutation({
    mutationFn: () => marketplaceApi.updateListingStatus(listing.id, { status: 'ACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ListingStatusBadge status={listing.status} />
        {listing.moderationStatus !== 'APPROVED' ? (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', MODERATION_TONE[listing.moderationStatus])}>
            {t(`marketplace.moderation.${listing.moderationStatus}`)}
          </span>
        ) : null}
        {listing.boost ? (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', BOOST_TONE[listing.boost.status])}>
            {t(`sellerDash.boost.status.${listing.boost.status}`)}
          </span>
        ) : null}
      </div>
      {listing.boost ? (
        <p className="text-xs text-muted-foreground">
          {t('sellerDash.products.boostWindow', { from: formatDate(listing.boost.startsAt), to: formatDate(listing.boost.endsAt) })}
        </p>
      ) : null}
      {listing.moderationNote && listing.moderationStatus !== 'APPROVED' ? (
        <p className="text-xs text-muted-foreground">{listing.moderationNote}</p>
      ) : null}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Eye className="size-3.5" aria-hidden />
          {t('sellerDash.products.views', { count: listing.viewCount })}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" aria-hidden />
          {t('sellerDash.products.inquiries', { count: listing.inquiryCount })}
        </span>
        <span className="inline-flex items-center gap-1" title={t('marketplace.my.contactsHint')}>
          {t('marketplace.my.contacts', { count: listing.contactCount })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3.5" aria-hidden />
          {t('marketplace.my.saves', { count: listing.saveCount })}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{t('sellerDash.products.listedOn', { date: formatDate(listing.publishedAt ?? listing.createdAt) })}</p>
      <div className="flex flex-wrap gap-1.5">
        {listing.moderationStatus !== 'REMOVED' ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/marketplace/my/listings/${listing.id}/edit`}>
              <Pencil aria-hidden />
              {t('marketplace.actions.edit')}
            </Link>
          </Button>
        ) : null}
        {listing.status === 'ACTIVE' ? (
          <Button type="button" size="sm" onClick={() => onMarkSold(listing)}>
            {t('marketplace.actions.markSold')}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate()}>
            <RotateCcw aria-hidden />
            {t('marketplace.actions.relist')}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={t('marketplace.actions.delete')} onClick={() => onDelete(listing)}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      {reactivateMutation.isError ? (
        <p className="text-xs text-destructive" role="alert">
          {reactivateMutation.error instanceof ApiRequestError ? reactivateMutation.error.message : t('marketplace.sell.saveError')}
        </p>
      ) : null}
    </div>
  )
}

export function MyMarketplacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [tab, setTab] = useState<ListingStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [soldTarget, setSoldTarget] = useState<MyListing | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyListing | null>(null)
  const [saleDialog, setSaleDialog] = useState<{ open: boolean; sale: MyMovingOutSale | null }>({ open: false, sale: null })

  const requested = searchParams.get('section')
  const section: SectionId = SECTIONS.some((item) => item.id === requested) ? (requested as SectionId) : 'products'
  const goTo = (id: SectionId) => setSearchParams(id === 'products' ? {} : { section: id }, { replace: true })

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname + location.search } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, location.search, navigate])

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const statusQuery = useSellerStatus()
  const dashboardQuery = useQuery({
    queryKey: ['marketplace', 'my-dashboard', tab, q],
    enabled: isAuthenticated,
    placeholderData: (previous) => previous,
    queryFn: () => marketplaceApi.dashboard(tab === 'ALL' ? undefined : tab, q || undefined),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketplaceApi.deleteListing(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      setDeleteTarget(null)
    },
  })

  const deleteSaleMutation = useMutation({
    mutationFn: (id: string) => marketplaceApi.deleteMovingOutSale(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  })

  if (isBootstrapping || !isAuthenticated || dashboardQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('marketplace.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void dashboardQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const dashboard = dashboardQuery.data
  const isPremium = dashboard.plan.code !== 'SELLER_FREE'
  const stats = [
    { label: t('sellerDash.summary.products'), value: dashboard.summary.totalProducts, icon: Box, section: 'products' as const },
    { label: t('sellerDash.summary.views'), value: dashboard.summary.totalViews, icon: Eye, section: 'insights' as const },
    { label: t('sellerDash.summary.inquiries'), value: dashboard.summary.newInquiries, icon: MessageSquare, section: 'inquiries' as const },
    { label: t('sellerDash.summary.boosts'), value: dashboard.summary.activeBoosts, icon: TrendingUp, section: 'boost' as const },
  ]

  return (
    <div className="space-y-6">
      <BackButton fallback="/marketplace" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('sellerDash.title')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goTo('subscription')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                isPremium ? 'border-[#e6c13f] bg-[#FFDE59]/50 text-[#3d2f00] dark:text-[#FFDE59]' : 'bg-muted',
              )}
              aria-label={t('sellerDash.currentPlanLabel', { plan: dashboard.plan.name })}
            >
              {isPremium ? <Crown className="size-3.5" aria-hidden /> : null}
              {dashboard.plan.name}
              {dashboard.plan.endsAt ? <span className="font-normal"> · {t('sellerDash.until', { date: formatDate(dashboard.plan.endsAt) })}</span> : null}
            </button>
            {statusQuery.data ? <SellerBadges badges={statusQuery.data.badges} /> : null}
          </div>
        </div>
        <Button asChild>
          <Link to="/marketplace/sell">
            <PackagePlus aria-hidden />
            {t('marketplace.sellItem')}
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <button key={stat.label} type="button" onClick={() => goTo(stat.section)} className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
              <stat.icon className="size-4" aria-hidden />
              {stat.label}
            </dt>
            <dd className="text-3xl font-semibold tabular-nums">{stat.value}</dd>
          </button>
        ))}
      </dl>

      <ListingAllowanceMeter allowance={dashboard.allowance} />

      <nav className="-mx-4 overflow-x-auto px-4" aria-label={t('sellerDash.navLabel')}>
        <ul className="flex min-w-max gap-1 rounded-xl bg-muted p-1">
          {SECTIONS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={section === item.id ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  section === item.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => goTo(item.id)}
              >
                <item.icon className="size-4" aria-hidden />
                {t(`sellerDash.sections.${item.id}`)}
                {item.id === 'inquiries' && dashboard.summary.newInquiries > 0 ? (
                  <span className="rounded-full bg-sky-600 px-1.5 text-xs text-white">{dashboard.summary.newInquiries}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {section === 'inquiries' ? <InquiriesSection /> : null}
      {section === 'insights' ? <InsightsSection onUpgrade={() => goTo('subscription')} /> : null}
      {section === 'boost' ? <BoostSection listings={dashboard.listings} /> : null}
      {section === 'subscription' ? <SubscriptionSection /> : null}

      {section === 'products' ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">{t('sellerDash.sections.products')}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="sr-only">{t('sellerDash.products.search')}</span>
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('sellerDash.products.search')}
                    className="h-9 w-48 rounded-md border bg-background pl-8 pr-2 text-sm"
                  />
                </label>
                <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('marketplace.my.filterLabel')}>
                  {(['ALL', 'ACTIVE', 'SOLD'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      className={cn(
                        'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                        tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setTab(value)}
                    >
                      {value === 'ALL' ? t('marketplace.my.all') : t(`marketplace.status.${value}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {dashboard.listings.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="font-medium">{q || tab !== 'ALL' ? t('sellerDash.products.noMatch') : t('marketplace.my.empty')}</p>
                {!q && tab === 'ALL' ? (
                  <Button asChild className="mt-3">
                    <Link to="/marketplace/sell">{t('marketplace.sellItem')}</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <ListingGrid className="lg:grid-cols-3">
                {dashboard.listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    hideSave
                    footer={<MyListingFooter listing={listing} onMarkSold={setSoldTarget} onDelete={setDeleteTarget} />}
                  />
                ))}
              </ListingGrid>
            )}
          </section>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="size-5 text-primary" aria-hidden />
                  {t('marketplace.movingOut.sectionTitle')}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t('marketplace.movingOut.mySubtitle')}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setSaleDialog({ open: true, sale: null })}>
                {t('marketplace.movingOut.createTitle')}
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.movingOutSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('marketplace.movingOut.myEmpty')}</p>
              ) : (
                <ul className="divide-y">
                  {dashboard.movingOutSales.map((sale) => (
                    <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <Link to={`/marketplace/moving-out-sales/${sale.id}`} className="font-medium hover:underline">
                          {sale.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {sale.destinationCity
                            ? t('marketplace.movingOut.route', { from: sale.originCity.name, to: sale.destinationCity.name })
                            : t('marketplace.movingOut.from', { from: sale.originCity.name })}
                          {' · '}
                          {t('marketplace.movingOut.itemCount', { count: sale.listingCount })}
                          {sale.moveOutDate ? ` · ${formatDate(sale.moveOutDate)}` : ''}
                          {!sale.isActive ? ` · ${t('marketplace.movingOut.ended')}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant="outline" onClick={() => setSaleDialog({ open: true, sale })}>
                          {t('marketplace.actions.edit')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={deleteSaleMutation.isPending}
                          onClick={() => {
                            if (window.confirm(t('marketplace.movingOut.deleteConfirm'))) deleteSaleMutation.mutate(sale.id)
                          }}
                        >
                          {t('marketplace.actions.delete')}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <MarkSoldDialog listing={soldTarget} onDismiss={() => setSoldTarget(null)} />
      <MovingOutSaleDialog open={saleDialog.open} sale={saleDialog.sale} onDismiss={() => setSaleDialog({ open: false, sale: null })} />

      <MarketplaceDialog
        open={Boolean(deleteTarget)}
        title={t('marketplace.deleteDialog.title')}
        description={t('marketplace.deleteDialog.body', { title: deleteTarget?.title ?? '' })}
        icon={<Trash2 className="size-5" aria-hidden />}
        tone="destructive"
        busy={deleteMutation.isPending}
        onDismiss={() => setDeleteTarget(null)}
      >
        {deleteMutation.isError ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {deleteMutation.error instanceof ApiRequestError ? deleteMutation.error.message : t('marketplace.sell.saveError')}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
            {deleteMutation.isPending ? t('common.loading') : t('marketplace.actions.delete')}
          </Button>
        </div>
      </MarketplaceDialog>
    </div>
  )
}
