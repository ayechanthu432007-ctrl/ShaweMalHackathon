import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { HouseCard } from './HouseCard'
import { RECENTLY_VIEWED_HOUSES_CHANGE_EVENT, getRecentlyViewedHouses } from '../lib/recently-viewed'
import type { HouseListItem } from '../types'

export function RecentlyViewedHouses() {
  const { t } = useTranslation()
  const [houses, setHouses] = useState<HouseListItem[]>([])

  useEffect(() => {
    const refresh = () => setHouses(getRecentlyViewedHouses())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(RECENTLY_VIEWED_HOUSES_CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(RECENTLY_VIEWED_HOUSES_CHANGE_EVENT, refresh)
    }
  }, [])

  if (houses.length === 0) return null

  return (
    <section aria-labelledby="recently-viewed-houses-title" className="space-y-4">
      <div>
        <h2 id="recently-viewed-houses-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('houses.recentlyViewed')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('houses.recentlyViewedSubtitle')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {houses.map((house) => (
          <HouseCard key={house.id} house={house} />
        ))}
      </div>
    </section>
  )
}
