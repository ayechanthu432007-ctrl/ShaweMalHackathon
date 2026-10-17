import { useQuery } from '@tanstack/react-query'
import { ChevronRight, PackageOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import { isMarketplaceDemoEnabled } from '../demo/marketplace-demo'

import { LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'

import { marketplaceApi } from '../api/marketplace-api'
import { ListingCard, ListingGrid } from '../components/ListingCard'
import { MarketplaceSearchBar } from '../components/MarketplaceSearchBar'
import { MovingOutSaleCard } from '../components/MovingOutSaleCard'
import { SellerAvatar } from '../components/SellerAvatar'
import { SellerBadges } from '../components/SellerBadges'
import { categoryLabel } from '../lib/marketplace-format'

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function MarketplaceHomePage() {
  const { t, i18n } = useTranslation()

  const homeQuery = useQuery({
    queryKey: ['marketplace', 'home'],
    queryFn: () => marketplaceApi.home(),
  })

  const home = homeQuery.data
  const recommended = home?.recommended ?? []

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('marketplace.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('marketplace.subtitle')}</p>
        </div>
        {isMarketplaceDemoEnabled() ? (
          <Button asChild variant="outline" className="border-gold/60">
            <Link to="/marketplace/demo">
              <FlaskConical aria-hidden />
              {t('marketplaceDemo.launch')}
            </Link>
          </Button>
        ) : null}
        <MarketplaceSearchBar />
      </div>

      {homeQuery.isLoading ? <LoadingState /> : null}

      {homeQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t('marketplace.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void homeQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {home ? (
        <>
          <Section title={t('marketplace.categoriesTitle')}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {home.categories.map((category) => (
                <li key={category.id}>
                  <Link
                    to={`/marketplace/search?categoryId=${category.id}`}
                    className="flex h-full flex-col rounded-lg border bg-card px-3 py-3 text-sm transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <span className="font-medium">{categoryLabel(category, i18n.language)}</span>
                    {category.children.length > 0 ? (
                      <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {category.children.slice(0, 3).map((child) => child.name).join(', ')}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('marketplace.recommendedTitle')}>
            {recommended.length > 0 ? (
              <ListingGrid>
                {recommended.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </ListingGrid>
            ) : (
              <p className="text-sm text-muted-foreground">{t('marketplace.recommendedEmpty')}</p>
            )}
          </Section>

          {home.featured && home.featured.length > 0 ? (
            <Section title={t('marketplace.featuredTitle')}>
              <ListingGrid>
                {home.featured.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </ListingGrid>
            </Section>
          ) : null}

          <Section
            title={t('marketplace.recentTitle')}
            action={
              <Button asChild variant="link" className="px-0">
                <Link to="/marketplace/search">
                  {t('marketplace.viewAll')}
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            }
          >
            {home.recentlyListed.length > 0 ? (
              <ListingGrid>
                {home.recentlyListed.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </ListingGrid>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
                <PackageOpen className="size-8 text-muted-foreground" aria-hidden />
                <p className="font-medium">{t('marketplace.emptyMarketTitle')}</p>
                <Button asChild>
                  <Link to="/marketplace/sell">{t('marketplace.sellItem')}</Link>
                </Button>
              </div>
            )}
          </Section>

          {home.movingOutSales.length > 0 ? (
            <Section title={t('marketplace.movingOut.sectionTitle')}>
              <p className="-mt-2 text-sm text-muted-foreground">{t('marketplace.movingOut.sectionSubtitle')}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {home.movingOutSales.map((sale) => (
                  <MovingOutSaleCard key={sale.id} sale={sale} />
                ))}
              </div>
            </Section>
          ) : null}

          {home.verifiedSellers.length > 0 ? (
            <Section title={t('marketplace.verifiedSellersTitle')}>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {home.verifiedSellers.map((seller) => (
                  <li key={seller.id}>
                    <Link
                      to={`/marketplace/sellers/${seller.id}`}
                      className="flex h-full items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary"
                    >
                      <SellerAvatar name={seller.name} path={seller.profilePicturePath} />
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{seller.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('marketplace.seller.activeCount', { count: seller.activeListingCount })}
                        </p>
                        <SellerBadges badges={seller.badges} compact />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
