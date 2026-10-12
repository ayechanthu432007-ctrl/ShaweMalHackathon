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

  return (
    <Card className={cn('group overflow-hidden transition-shadow duration-200 hover:shadow-lg', className)}>
      <Link
        to={`/houses/${house.id}`}
        className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
            <HouseAvailabilityBadge availability={house.availability} className="shadow-sm" />
            {/* Paid placement is always disclosed to visitors, in the wording listing sites commonly use. */}
            {house.isBoosted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm">
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                {t('houses.boosted')}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-9 w-9 rounded-full bg-background/90 shadow-sm"
            aria-label={isWishlisted ? t('houses.removeWishlist') : t('houses.addWishlist')}
            aria-pressed={isWishlisted}
            disabled={isToggling}
            onClick={onToggleWishlist}
          >
            <Heart className={cn('size-4 transition-colors', isWishlisted && 'fill-primary text-primary')} />
          </Button>
        </div>
        <CardContent className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-lg font-bold leading-tight text-primary">
            {formatFees(house.monthlyFees)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{t('houses.perMonth')}</span>
          </p>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{house.title}</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{house.city?.name ?? t('houses.locationUnknown')}</span>
            </p>
            {house.propertyType?.name ? (
              <p className="flex items-center gap-1.5">
                <Building2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{house.propertyType.name}</span>
              </p>
            ) : null}
          </div>
          {facts.length > 0 ? (
            <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm">
              {facts.map((fact) => (
                <li key={fact.key} className="flex items-center gap-1.5">
                  <fact.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {fact.text}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Link>
    </Card>
  )
}
