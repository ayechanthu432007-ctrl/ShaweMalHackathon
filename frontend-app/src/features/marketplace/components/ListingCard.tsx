import { Heart, MapPin, Star } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

import { useSavedListings } from '../hooks/useMarketplaceData'
import { formatPrice } from '../lib/marketplace-format'
import type { ListingCard as ListingCardData } from '../types'
import { SellerBadges } from './SellerBadges'

type ListingCardProps = {
  listing: ListingCardData
  className?: string
  /** Extra controls rendered under the card body (seller dashboard actions). */
  footer?: ReactNode
  hideSave?: boolean
}

export function ListingStatusBadge({ status, className }: { status: ListingCardData['status']; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm',
        status === 'SOLD' ? 'bg-foreground text-background' : 'bg-emerald-600 text-white',
        className,
      )}
    >
      {t(`marketplace.status.${status}`)}
    </span>
  )
}

export function ListingCard({ listing, className, footer, hideSave = false }: ListingCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { savedIds, save, unsave, isToggling } = useSavedListings()
  const isSaved = savedIds.has(listing.id)
  const thumbnailSrc = resolvePublicUploadUrl(listing.thumbnail)

  const onToggleSave = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (!isAuthenticated) {
      navigate('/sign-in', { state: { from: location.pathname, authPrompt: 'wishlist' } })
      return
    }

    if (isSaved) {
      await unsave(listing.id)
    } else {
      await save(listing.id)
    }
  }

  return (
    <Card className={cn('flex flex-col overflow-hidden transition-shadow hover:shadow-md', className)}>
      <Link
        to={`/marketplace/items/${listing.id}`}
        className="block flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-square bg-muted">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={listing.title}
              className={cn('h-full w-full object-cover', listing.status === 'SOLD' && 'opacity-60 grayscale')}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('marketplace.noPhoto')}
            </div>
          )}
          {listing.status === 'SOLD' ? <ListingStatusBadge status="SOLD" className="absolute left-2 top-2" /> : null}
          {!hideSave && listing.status !== 'SOLD' ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2 h-9 w-9 rounded-full bg-background/90"
              aria-label={isSaved ? t('marketplace.unsave') : t('marketplace.save')}
              aria-pressed={isSaved}
              disabled={isToggling}
              onClick={onToggleSave}
            >
              <Heart className={cn('size-4', isSaved && 'fill-primary text-primary')} />
            </Button>
          ) : null}
        </div>
        <CardContent className="space-y-1.5 p-3">
          <p className="text-base font-semibold text-primary">{formatPrice(listing.price)}</p>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{listing.title}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{listing.city.name}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{t(`marketplace.condition.${listing.condition}`)}</span>
          </p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="truncate text-xs text-muted-foreground">{listing.seller.name}</span>
            {listing.seller.rating.average != null ? (
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {listing.seller.rating.average.toFixed(1)}
              </span>
            ) : null}
          </div>
          <SellerBadges badges={listing.seller.badges} compact />
        </CardContent>
      </Link>
      {footer ? <div className="border-t p-3">{footer}</div> : null}
    </Card>
  )
}

export function ListingGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}>{children}</div>
}
