import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/common/PageStates'
import { CarouselControls } from '@/components/ui/carousel-controls'
import { useSwipe } from '@/components/ui/use-swipe'
import { homeApi } from '@/features/home/api/home-api'
import { useViewportReady } from '@/lib/use-viewport-ready'

import { HouseCard } from './HouseCard'

const FEATURED_PAGE_SIZE = 3

export function FeatureHouses() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const { ref, isVisible } = useViewportReady({ rootMargin: '200px 0px', initialVisible: false })

  const featuredQuery = useQuery({
    queryKey: ['home'],
    enabled: isVisible,
    queryFn: () => homeApi.getContent(),
  })

  const featuredHouses = featuredQuery.data?.featuredHouses ?? []
  const totalPages = Math.max(1, Math.ceil(featuredHouses.length / FEATURED_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const goTo = (target: number) => setPage(Math.max(0, Math.min(totalPages - 1, target)))
  // Paged, not scrolled: a sideways swipe turns the page like the Popular Houses row does.
  const swipe = useSwipe({ onPrev: () => goTo(currentPage - 1), onNext: () => goTo(currentPage + 1) })

  const visibleHouses = featuredHouses.slice(
    currentPage * FEATURED_PAGE_SIZE,
    currentPage * FEATURED_PAGE_SIZE + FEATURED_PAGE_SIZE,
  )

  return (
    <section ref={ref} className="space-y-4">
      {/* The heading is always shown, so only the cards swap in when the data arrives (no jump). */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('home.featuredTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('home.featuredSubtitle')}</p>
      </div>
      {!isVisible && !featuredQuery.data ? (
        <CardGridSkeleton className="grid grid-cols-1 gap-4 md:grid-cols-3" withControls />
      ) : featuredQuery.isLoading ? (
        <CardGridSkeleton className="grid grid-cols-1 gap-4 md:grid-cols-3" withControls />
      ) : featuredQuery.isError ? (
        <ErrorState message={t('home.loadError')} onRetry={() => void featuredQuery.refetch()} />
      ) : featuredHouses.length === 0 ? (
        <EmptyState text={t('home.emptyFeatured')} />
      ) : (
        <>
          <ul aria-label={t('home.featuredTitle')} className="grid grid-cols-1 gap-4 md:grid-cols-3" {...swipe}>
            {visibleHouses.map((house) => (
              <li key={house.id}>
                <HouseCard house={house} className="h-full" />
              </li>
            ))}
          </ul>
          <CarouselControls index={currentPage} count={totalPages} onChange={goTo} />
        </>
      )}
    </section>
  )
}
