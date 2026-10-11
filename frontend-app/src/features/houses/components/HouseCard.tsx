import { Heart, Star } from 'lucide-react'
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
    'id' | 'title' | 'monthlyFees' | 'propertyType' | 'city' | 'thumbnail' | 'bedrooms' | 'bathrooms' | 'availability' | 'isBoosted'
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

  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', className)}>
      <Link to={`/houses/${house.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative aspect-[16/10] bg-muted">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={house.title}
              className="h-full w-full object-cover"
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
            className="absolute right-2 top-2 h-9 w-9 rounded-full bg-background/90"
            aria-label={isWishlisted ? t('houses.removeWishlist') : t('houses.addWishlist')}
            aria-pressed={isWishlisted}
            disabled={isToggling}
            onClick={onToggleWishlist}
          >
            <Heart className={cn('size-4', isWishlisted && 'fill-primary text-primary')} />
          </Button>
        </div>
        <CardContent className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{house.title}</h3>
          <p className="text-sm text-muted-foreground">
            {[house.city?.name, house.propertyType?.name].filter(Boolean).join(' · ') || t('houses.locationUnknown')}
          </p>
          <p className="text-sm font-medium text-primary">
            {t('houses.monthlyFees', { amount: formatFees(house.monthlyFees) })}
          </p>
          {typeof house.bedrooms === 'number' || typeof house.bathrooms === 'number' ? (
            <p className="text-xs text-muted-foreground">
              {t('houses.roomsSummary', {
                bedrooms: house.bedrooms ?? '—',
                bathrooms: house.bathrooms ?? '—',
              })}
            </p>
          ) : null}
        </CardContent>
      </Link>
    </Card>
  )
}
