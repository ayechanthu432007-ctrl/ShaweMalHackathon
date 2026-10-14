import { Bath, BedDouble, Building2, Heart, MapPin, Ruler, Star } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

function formatFees(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} MMK`
}

export function HouseCard({ house, className }: HouseCardProps) {
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
        'group overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none',
        className,
      )}
    >
      <Link
        to={`/houses/${house.id}`}
        className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={house.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('houses.noPhoto')}
            </div>
          )}
          <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5 pr-14">
            <HouseAvailabilityBadge availability={house.availability} className="shadow-sm" />
            {house.propertyType?.name ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
                <Building2 className="size-3.5 text-primary" aria-hidden />
                {house.propertyType.name}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2.5 top-2.5 h-9 w-9 rounded-full bg-background/90 shadow-sm backdrop-blur"
            aria-label={isWishlisted ? t('houses.removeWishlist') : t('houses.addWishlist')}
            aria-pressed={isWishlisted}
            disabled={isToggling}
            onClick={onToggleWishlist}
          >
            <Heart className={cn('size-4 transition-colors', isWishlisted && 'fill-primary text-primary')} />
          </Button>
        </div>
        <CardContent className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight">{house.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place || t('houses.locationUnknown')}</span>
          </p>
          {/* Nearby distance and transit rows appear here only once listings record them. */}
          {facts.length > 0 ? (
            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-y py-2.5 text-sm text-foreground/80">
              {facts.map((fact) => (
                <li key={fact.key} className="flex items-center gap-1.5">
                  <fact.icon className="size-4 shrink-0 text-primary" aria-hidden />
                  {fact.text}
                </li>
              ))}
            </ul>
          ) : null}
          {/* Only labels the listing really earns; paid placement is always disclosed. */}
          {house.isBoosted ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Star className="size-3 fill-amber-500 text-amber-500" aria-hidden />
                {t('houses.boosted')}
              </span>
            </div>
          ) : null}
          <p className="mt-auto pt-4 text-sm text-muted-foreground">
            {t('houses.priceFrom')}{' '}
            <span className="text-xl font-extrabold tracking-tight text-gold-hover">{formatFees(house.monthlyFees)}</span>
            {t('houses.perMonthShort')}
          </p>
        </CardContent>
      </Link>
    </Card>
  )
}
