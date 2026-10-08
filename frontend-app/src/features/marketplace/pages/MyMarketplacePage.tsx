import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Heart, PackagePlus, Pencil, RotateCcw, Trash2, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
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
import { SellerBadges } from '../components/SellerBadges'
import { useSellerStatus } from '../hooks/useMarketplaceData'
import { formatDate } from '../lib/marketplace-format'
import type { ListingStatus, MyListing, MyMovingOutSale } from '../types'

const MODERATION_TONE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  REJECTED: 'bg-destructive/10 text-destructive',
  REMOVED: 'bg-destructive/10 text-destructive',
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
      </div>
      {listing.moderationNote && listing.moderationStatus !== 'APPROVED' ? (
        <p className="text-xs text-muted-foreground">{listing.moderationNote}</p>
      ) : null}
      <p className="flex gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1" title={t('marketplace.my.contactsHint')}>
          <Eye className="size-3.5" aria-hidden />
          {t('marketplace.my.contacts', { count: listing.contactCount })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3.5" aria-hidden />
          {t('marketplace.my.saves', { count: listing.saveCount })}
        </span>
      </p>
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
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [tab, setTab] = useState<ListingStatus | 'ALL'>('ALL')
  const [soldTarget, setSoldTarget] = useState<MyListing | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyListing | null>(null)
  const [saleDialog, setSaleDialog] = useState<{ open: boolean; sale: MyMovingOutSale | null }>({ open: false, sale: null })

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const statusQuery = useSellerStatus()
  const dashboardQuery = useQuery({
    queryKey: ['marketplace', 'my-dashboard', tab],
    enabled: isAuthenticated,
    queryFn: () => marketplaceApi.dashboard(tab === 'ALL' ? undefined : tab),
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
  const stats = [
    { label: t('marketplace.my.activeCount'), value: dashboard.activeCount },
    { label: t('marketplace.my.soldCount'), value: dashboard.soldCount },
    { label: t('marketplace.my.attentionCount'), value: dashboard.needsAttentionCount },
  ]

  return (
    <div className="space-y-8">
      <BackButton fallback="/marketplace" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('marketplace.myMarketplace')}</h1>
          {statusQuery.data ? <SellerBadges badges={statusQuery.data.badges} /> : null}
        </div>
        <Button asChild>
          <Link to="/marketplace/sell">
            <PackagePlus aria-hidden />
            {t('marketplace.sellItem')}
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground sm:text-sm">{stat.label}</dt>
            <dd className="text-3xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t('marketplace.my.listingsTitle')}</h2>
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

        {dashboard.listings.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">{t('marketplace.my.empty')}</p>
            <Button asChild className="mt-3">
              <Link to="/marketplace/sell">{t('marketplace.sellItem')}</Link>
            </Button>
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
