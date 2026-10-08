import { useQuery } from '@tanstack/react-query'
import { Flag, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StarRating } from '@/features/reviews/components/StarRating'
import { cn } from '@/lib/utils'

import { marketplaceApi } from '../api/marketplace-api'
import { ListingCard, ListingGrid } from '../components/ListingCard'
import { ReportDialog } from '../components/ReportDialog'
import { SellerAvatar } from '../components/SellerAvatar'
import { SellerBadges } from '../components/SellerBadges'
import { formatDate } from '../lib/marketplace-format'
import type { ListingStatus } from '../types'

export function SellerProfilePage() {
  const { t } = useTranslation()
  const { sellerId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [tab, setTab] = useState<ListingStatus>('ACTIVE')
  const [reportOpen, setReportOpen] = useState(false)

  const sellerQuery = useQuery({
    queryKey: ['marketplace', 'seller', sellerId],
    queryFn: () => marketplaceApi.getSeller(sellerId),
    enabled: Boolean(sellerId),
  })

  const listingsQuery = useQuery({
    queryKey: ['marketplace', 'seller', sellerId, 'listings', tab],
    queryFn: () => marketplaceApi.search({ sellerId, status: tab, pageSize: 48 }),
    enabled: Boolean(sellerId),
  })

  if (sellerQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const seller = sellerQuery.data?.seller
  if (sellerQuery.isError || !seller) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('marketplace.seller.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/marketplace">{t('marketplace.backToMarketplace')}</Link>
        </Button>
      </div>
    )
  }

  const stats = [
    { label: t('marketplace.seller.statListings'), value: seller.listingCount },
    { label: t('marketplace.seller.statActive'), value: seller.activeListingCount },
    { label: t('marketplace.seller.statSold'), value: seller.soldListingCount },
    { label: t('marketplace.seller.statReviews'), value: seller.rating.count },
  ]

  return (
    <div className="space-y-8">
      <BackButton fallback="/marketplace" />
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-start">
          <SellerAvatar name={seller.name} path={seller.profilePicturePath} size="lg" />
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{seller.name}</h1>
              <p className="text-sm text-muted-foreground">{t('marketplace.seller.joined', { date: formatDate(seller.joinedAt) })}</p>
            </div>
            <p className="flex items-center gap-1.5 text-sm">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
              {seller.rating.average != null
                ? t('marketplace.seller.rating', { rating: seller.rating.average.toFixed(1), count: seller.rating.count })
                : t('marketplace.seller.noRatings')}
            </p>
            <SellerBadges badges={seller.badges} showDescriptions />
          </div>
          <div className="flex gap-2 md:flex-col">
            <Button asChild>
              <a href="#seller-listings">{t('marketplace.seller.viewListings')}</a>
            </Button>
            {user?.id !== seller.id ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => (isAuthenticated ? setReportOpen(true) : navigate('/sign-in', { state: { from: location.pathname } }))}
              >
                <Flag aria-hidden />
                {t('marketplace.report.sellerAction')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 text-center">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section id="seller-listings" className="scroll-mt-4 space-y-4">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('marketplace.seller.listingsTabs')}>
          {(['ACTIVE', 'SOLD'] as const).map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={tab === status}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === status ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab(status)}
            >
              {status === 'ACTIVE'
                ? t('marketplace.seller.activeTab', { count: seller.activeListingCount })
                : t('marketplace.seller.soldTab', { count: seller.soldListingCount })}
            </button>
          ))}
        </div>
        {listingsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {listingsQuery.data && listingsQuery.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('marketplace.seller.noListings')}</p>
        ) : null}
        <ListingGrid>
          {listingsQuery.data?.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ListingGrid>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('marketplace.seller.reviewsTitle')}</h2>
        {seller.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('marketplace.seller.noReviews')}</p>
        ) : (
          <ul className="space-y-3">
            {seller.reviews.map((review) => (
              <li key={review.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StarRating value={review.rating} readOnly size="sm" />
                    <span className="text-sm font-medium">{review.reviewer.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                </div>
                {review.listing ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('marketplace.seller.reviewFor')}{' '}
                    <Link to={`/marketplace/items/${review.listing.id}`} className="hover:underline">
                      {review.listing.title}
                    </Link>
                  </p>
                ) : null}
                {review.comment ? <p className="mt-2 text-sm">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReportDialog open={reportOpen} target={{ reportedUserId: seller.id }} onDismiss={() => setReportOpen(false)} />
    </div>
  )
}
