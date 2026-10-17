import { MapPin, Star } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { CoverImage } from '@/components/common/CoverImage'
import { FavoriteButton } from '@/components/common/FavoriteButton'
import { Badge } from '@/components/ui/badge'
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
    <Badge tone={status === 'SOLD' ? 'solid' : 'success'} className={cn('shadow-sm', className)}>
      {t(`marketplace.status.${status}`)}
    </Badge>
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
    <Card
      className={cn(
        'group relative flex flex-col overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transform-none',
        className,
      )}
    >
      <Link
        to={`/marketplace/items/${listing.id}`}
        className="block flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <CoverImage
            src={thumbnailSrc}
            alt={listing.title}
            fallbackLabel={t('marketplace.noPhoto')}
            className={cn(
              'transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none',
              listing.status === 'SOLD' && 'opacity-60 grayscale',
            )}
          />
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 pr-12">
            {listing.status === 'SOLD' ? <ListingStatusBadge status="SOLD" /> : null}
            {listing.boosted && listing.status !== 'SOLD' ? <Badge tone="cta">{t('marketplace.boosted')}</Badge> : null}
          </div>
        </div>
        <CardContent className="space-y-1.5 p-3 sm:p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{listing.title}</h3>
          <p className="text-base font-extrabold tracking-tight sm:text-lg">{formatPrice(listing.price)}</p>
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
      {!hideSave && listing.status !== 'SOLD' ? (
        <FavoriteButton
          className="absolute right-2.5 top-2.5"
          active={isSaved}
          label={isSaved ? t('marketplace.unsave') : t('marketplace.save')}
          disabled={isToggling}
          onToggle={onToggleSave}
        />
      ) : null}
      {footer ? <div className="relative border-t p-3">{footer}</div> : null}
    </Card>
  )
}

export function ListingGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4', className)}>{children}</div>
}
