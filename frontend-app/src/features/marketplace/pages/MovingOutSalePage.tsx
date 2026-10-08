import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Truck } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { marketplaceApi } from '../api/marketplace-api'
import { ListingCard, ListingGrid } from '../components/ListingCard'
import { SellerAvatar } from '../components/SellerAvatar'
import { SellerBadges } from '../components/SellerBadges'
import { formatDate } from '../lib/marketplace-format'

export function MovingOutSalePage() {
  const { t } = useTranslation()
  const { saleId = '' } = useParams()

  const saleQuery = useQuery({
    queryKey: ['marketplace', 'moving-out-sale', saleId],
    queryFn: () => marketplaceApi.getMovingOutSale(saleId),
    enabled: Boolean(saleId),
  })

  const listingsQuery = useQuery({
    queryKey: ['marketplace', 'moving-out-sale', saleId, 'listings'],
    queryFn: () => marketplaceApi.search({ movingOutSaleId: saleId, pageSize: 48 }),
    enabled: Boolean(saleId),
  })

  if (saleQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const sale = saleQuery.data?.sale
  if (saleQuery.isError || !sale) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('marketplace.movingOut.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/marketplace">{t('marketplace.backToMarketplace')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackButton fallback="/marketplace" />
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="space-y-4 p-6">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Truck className="size-3.5" aria-hidden />
            {t('marketplace.movingOut.badge')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{sale.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {sale.originCity.name}
              {sale.destinationCity ? (
                <>
                  <ArrowRight className="size-4" aria-hidden />
                  {sale.destinationCity.name}
                </>
              ) : null}
            </span>
            {sale.moveOutDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                {t('marketplace.movingOut.leaving', { date: formatDate(sale.moveOutDate) })}
              </span>
            ) : null}
            {!sale.isActive ? <span className="font-medium text-foreground">{t('marketplace.movingOut.ended')}</span> : null}
          </div>
          {sale.description ? <p className="whitespace-pre-line text-sm">{sale.description}</p> : null}
          <Link to={`/marketplace/sellers/${sale.seller.id}`} className="flex w-fit items-center gap-3 rounded-lg p-1 hover:bg-muted/60">
            <SellerAvatar name={sale.seller.name} path={sale.seller.profilePicturePath} />
            <div>
              <p className="font-medium">{sale.seller.name}</p>
              <SellerBadges badges={sale.seller.badges} compact />
            </div>
          </Link>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('marketplace.movingOut.itemCount', { count: listingsQuery.data?.total ?? sale.activeListingCount })}</h2>
        {listingsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {listingsQuery.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('marketplace.movingOut.allSold')}</p> : null}
        <ListingGrid>
          {listingsQuery.data?.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ListingGrid>
      </section>
    </div>
  )
}
