import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { HouseCard } from '@/features/houses/components/HouseCard'
import { wishlistApi } from '@/features/houses/api/wishlist-api'
import { ListingCard, ListingGrid } from '@/features/marketplace/components/ListingCard'
import { useSavedListings } from '@/features/marketplace/hooks/useMarketplaceData'
import { cn } from '@/lib/utils'

type WishlistTab = 'houses' | 'items'

export function WishlistPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: WishlistTab = searchParams.get('tab') === 'items' ? 'items' : 'houses'
  const { savedQuery } = useSavedListings()

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    enabled: isAuthenticated,
    queryFn: () => wishlistApi.list(),
  })

  if (isBootstrapping || !isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const tabs = (
    <div className="flex w-fit gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('nav.wishlist')}>
      {(['houses', 'items'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setSearchParams(value === 'items' ? { tab: 'items' } : {})}
        >
          {value === 'houses' ? t('profile.wishlistHousesTab') : t('profile.wishlistItemsTab')}
        </button>
      ))}
    </div>
  )

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-2xl font-semibold">{t('nav.wishlist')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.wishlistSubtitle')}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/profile">{t('nav.profile')}</Link>
      </Button>
    </div>
  )

  if (tab === 'items') {
    const savedItems = savedQuery.data?.items ?? []
    return (
      <div className="space-y-4">
        {header}
        {tabs}
        {savedQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {savedQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{t('profile.wishlistError')}</p>
            <Button type="button" variant="outline" onClick={() => void savedQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : null}
        {savedQuery.data && savedItems.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('profile.wishlistItemsEmpty')}</p>
            <Button asChild variant="outline">
              <Link to="/marketplace">{t('nav.marketplace')}</Link>
            </Button>
          </div>
        ) : null}
        {savedItems.length > 0 ? (
          <ListingGrid>
            {savedItems.map((item) => (
              <ListingCard key={item.id} listing={item.listing} />
            ))}
          </ListingGrid>
        ) : null}
      </div>
    )
  }

  if (wishlistQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (wishlistQuery.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('profile.wishlistError')}</p>
        <Button type="button" variant="outline" onClick={() => void wishlistQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const items = wishlistQuery.data?.items ?? []

  return (
    <div className="space-y-4">
      {header}
      {tabs}

      {items.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t('profile.wishlistEmpty')}</p>
          <Button asChild variant="outline">
            <Link to="/finding-house">{t('nav.findingHouse')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <HouseCard key={item.id} house={item.house} />
          ))}
        </div>
      )}
    </div>
  )
}
