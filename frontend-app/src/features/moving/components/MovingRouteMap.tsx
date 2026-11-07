import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import type { MovingRouteMapProps } from './moving-route-map-types'

const MovingRouteMapInner = lazy(() => import('./MovingRouteMapInner'))

export type { MovingPinRole, MovingRouteMapProps } from './moving-route-map-types'

export function MovingRouteMap(props: MovingRouteMapProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <Suspense
        fallback={
          <div className="flex h-72 items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        }
      >
        <MovingRouteMapInner {...props} />
      </Suspense>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t('moving.mapLegend')}>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-teal-700" aria-hidden />
          {t('moving.pickupPinLegend')}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-orange-700" aria-hidden />
          {t('moving.dropoffPinLegend')}
        </li>
      </ul>
    </div>
  )
}
