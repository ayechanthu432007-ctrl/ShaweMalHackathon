import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'

import { adminMarketplaceApi, type MarketplaceOverview } from '../api/admin-marketplace-api'
import { AdminMarketplaceNav } from '../components/AdminMarketplaceNav'

const CARDS: Array<{ key: keyof MarketplaceOverview; to: string }> = [
  { key: 'totalListings', to: '/admin/marketplace/listings' },
  { key: 'activeListings', to: '/admin/marketplace/listings?status=ACTIVE&moderationStatus=APPROVED' },
  { key: 'soldItems', to: '/admin/marketplace/listings?status=SOLD' },
  { key: 'reportedListings', to: '/admin/marketplace/listings?reported=true' },
  { key: 'suspendedSellers', to: '/admin/marketplace/users?accountStatus=SUSPENDED' },
  { key: 'pendingReviews', to: '/admin/marketplace/listings?moderationStatus=PENDING' },
]

export function AdminMarketplacePage() {
  const { t } = useTranslation()

  const overviewQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'overview'],
    queryFn: () => adminMarketplaceApi.overview(),
  })

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.marketplace.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('admin.marketplace.subtitle')}</p>
      </div>
      <AdminMarketplaceNav />

      {overviewQuery.isLoading ? <LoadingState /> : null}
      {overviewQuery.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{t('admin.marketplace.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void overviewQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {overviewQuery.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((card) => (
              <Link
                key={card.key}
                to={card.to}
                className="rounded-xl border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-sm text-muted-foreground">{t(`admin.marketplace.overview.${card.key}`)}</p>
                <p className="mt-1 text-3xl font-semibold">{overviewQuery.data[card.key]}</p>
              </Link>
            ))}
          </div>
          {overviewQuery.data.openReports > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm">{t('admin.marketplace.overview.openReportsBanner', { count: overviewQuery.data.openReports })}</p>
              <Button asChild size="sm">
                <Link to="/admin/marketplace/reports">{t('admin.marketplace.overview.reviewReports')}</Link>
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
