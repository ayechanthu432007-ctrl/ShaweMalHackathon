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
import { isHouseAvailable } from '../lib/availability'
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

  const available = isHouseAvailable(house.availability)
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
          <p className="text-xl font-extrabold leading-tight tracking-tight text-primary">
            {formatFees(house.monthlyFees)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">{t('houses.perMonth')}</span>
          </p>
          <h3 className="mt-1.5 line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug">{house.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{place || t('houses.locationUnknown')}</span>
            </p>
            {house.propertyType?.name ? (
              <p className="flex items-center gap-1.5">
                <Building2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{house.propertyType.name}</span>
              </p>
            ) : null}
          </div>
          {facts.length > 0 ? (
            <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {facts.map((fact) => (
                <li key={fact.key} className="flex items-center gap-1.5 font-medium">
                  <fact.icon className="size-4 shrink-0 text-primary/80" aria-hidden />
                  {fact.text}
                </li>
              ))}
            </ul>
          ) : null}
          {/* Only labels the listing really earns: its availability and, when paid for, Featured. */}
          <div className="mt-auto pt-3">
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                available ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
              )}
            >
              {available ? t('houses.available') : t('houses.notAvailable')}
            </span>
            {/* Paid placement is always disclosed to visitors, in the wording listing sites commonly use. */}
            {house.isBoosted ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                {t('houses.boosted')}
              </span>
            ) : null}
          </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
