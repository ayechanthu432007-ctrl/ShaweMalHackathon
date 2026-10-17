import { Bath, BedDouble, Building2, MapPin, Ruler, Star } from 'lucide-react'
import { memo, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { CoverImage } from '@/components/common/CoverImage'
import { FavoriteButton } from '@/components/common/FavoriteButton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatMmk } from '@/lib/format'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

import type { HouseListItem } from '../types'
import { HouseAvailabilityBadge } from './HouseAvailabilityBadge'
import { useWishlist } from '../hooks/useWishlist'

type HouseCardProps = {
  house: Pick<
    HouseListItem,
    | 'id'
    | 'title'
    | 'monthlyFees'
    | 'propertyType'
    | 'city'
    | 'state'
    | 'thumbnail'
    | 'bedrooms'
    | 'bathrooms'
    | 'areaSize'
    | 'availability'
    | 'isBoosted'
  >
  className?: string
}

/** Memoized: house objects come straight from the query cache, so lists only re-render cards that changed. */
export const HouseCard = memo(function HouseCard({ house, className }: HouseCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { wishlistedIds, add, remove, isToggling } = useWishlist()
  const isWishlisted = wishlistedIds.has(house.id)
  const thumbnailSrc = resolvePublicUploadUrl(house.thumbnail)

  const onToggleWishlist = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (!isAuthenticated) {
      navigate('/sign-in', { state: { from: '/', authPrompt: 'wishlist' } })
      return
    }

    if (isWishlisted) {
      await remove(house.id)
      return
    }

    await add(house.id)
  }

  // Only facts the listing actually has are shown.
  const facts = [
    typeof house.bedrooms === 'number' ? { key: 'bed', icon: BedDouble, text: t('houses.bedCount', { count: house.bedrooms }) } : null,
    typeof house.bathrooms === 'number' ? { key: 'bath', icon: Bath, text: t('houses.bathCount', { count: house.bathrooms }) } : null,
    house.areaSize ? { key: 'area', icon: Ruler, text: house.areaSize } : null,
  ].flatMap((fact) => (fact ? [fact] : []))

  const place = [house.city?.name, house.state?.name].filter(Boolean).join(', ')

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transform-none',
        className,
      )}
    >
      <Link
        to={`/houses/${house.id}`}
        className="flex h-full flex-col rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <CoverImage
            src={thumbnailSrc}
            alt={house.title}
            fallbackLabel={t('houses.noPhoto')}
            className="transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
          />
          <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5 pr-12">
            <HouseAvailabilityBadge availability={house.availability} className="shadow-sm" />
            {house.propertyType?.name ? (
              <Badge tone="outline" className="border-transparent bg-background/90 shadow-sm backdrop-blur">
                <Building2 className="text-brand-sky-strong" aria-hidden />
                {house.propertyType.name}
              </Badge>
            ) : null}
          </div>
        </div>
        <CardContent className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight">{house.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place || t('houses.locationUnknown')}</span>
          </p>
          {/* Nearby distance and transit rows appear here only once listings record them. */}
          {facts.length > 0 ? (
            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-y py-2.5 text-sm text-foreground/80">
              {facts.map((fact) => (
                <li key={fact.key} className="flex items-center gap-1.5">
                  <fact.icon className="size-4 shrink-0 text-brand-sky-strong" aria-hidden />
                  {fact.text}
                </li>
              ))}
            </ul>
          ) : null}
          {/* Only labels the listing really earns; paid placement is always disclosed. */}
          {house.isBoosted ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="premium">
                <Star className="fill-current" aria-hidden />
                {t('houses.boosted')}
              </Badge>
            </div>
          ) : null}
          <p className="mt-auto pt-4 text-sm text-muted-foreground">
            {t('houses.priceFrom')}{' '}
            <span className="text-xl font-extrabold tracking-tight text-foreground">{formatMmk(house.monthlyFees)}</span>
            {t('houses.perMonthShort')}
          </p>
        </CardContent>
      </Link>
      {/* Beside the link, not inside it: a button nested in a link is not reachable as its own control. */}
      <FavoriteButton
        className="absolute right-2.5 top-2.5"
        active={isWishlisted}
        label={isWishlisted ? t('houses.removeWishlist') : t('houses.addWishlist')}
        disabled={isToggling}
        onToggle={onToggleWishlist}
      />
    </Card>
  )
})
