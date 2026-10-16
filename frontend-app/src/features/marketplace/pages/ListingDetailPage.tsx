import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, Heart, MapPin, PackageCheck, Pencil, Star, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StarRating } from '@/features/reviews/components/StarRating'
import { ApiRequestError } from '@/lib/api/client'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

import { marketplaceApi } from '../api/marketplace-api'
import { AskSellerCard } from '../components/AskSellerCard'
import { ContactSellerButtons } from '../components/ContactSellerButtons'
import { ListingStatusBadge } from '../components/ListingCard'
import { textareaClassName } from '../components/MarketplaceDialog'
import { ReportDialog } from '../components/ReportDialog'
import { SellerAvatar } from '../components/SellerAvatar'
import { SellerBadges } from '../components/SellerBadges'
import { useSavedListings } from '../hooks/useMarketplaceData'
import { categoryLabel, formatDate, formatPrice } from '../lib/marketplace-format'
import type { ListingDetail } from '../types'

function ReviewSellerForm({ listing }: { listing: ListingDetail }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const reviewMutation = useMutation({
    mutationFn: () => marketplaceApi.reviewSeller(listing.id, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace', 'listing', listing.id] }),
  })

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <CardTitle id="review-seller-title">{t('marketplace.review.title', { name: listing.seller.name })}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (rating > 0) reviewMutation.mutate()
          }}
        >
          <StarRating value={rating} onChange={setRating} labelledBy="review-seller-title" />
          <textarea
            className={textareaClassName}
            maxLength={1000}
            aria-label={t('marketplace.review.commentLabel')}
            placeholder={t('marketplace.review.commentPlaceholder')}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          {reviewMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {reviewMutation.error instanceof ApiRequestError ? reviewMutation.error.message : t('marketplace.review.error')}
            </p>
          ) : null}
          <Button type="submit" disabled={rating === 0 || reviewMutation.isPending}>
            {reviewMutation.isPending ? t('common.loading') : t('marketplace.review.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Gallery({ listing }: { listing: ListingDetail }) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState(0)
  const active = listing.images[activeIndex] ?? listing.images[0]

  if (!active) {
    return <div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-muted-foreground">{t('marketplace.noPhoto')}</div>
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <img
          src={resolvePublicUploadUrl(active.optimizedPath) ?? ''}
          alt={listing.title}
          className={cn('aspect-square w-full object-contain', listing.status === 'SOLD' && 'opacity-70')}
        />
        {listing.status === 'SOLD' ? <ListingStatusBadge status="SOLD" className="absolute left-3 top-3 px-3 py-1 text-sm" /> : null}
      </div>
      {listing.images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {listing.images.map((image, index) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={t('marketplace.photos.photoAlt', { index: index + 1 })}
                aria-current={index === activeIndex}
                className={cn(
                  'block size-16 overflow-hidden rounded-md border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === activeIndex ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                <img src={resolvePublicUploadUrl(image.thumbnailPath) ?? ''} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ListingDetailPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const [reportOpen, setReportOpen] = useState(false)
  const { save, unsave, isToggling } = useSavedListings()

  const listingQuery = useQuery({
    queryKey: ['marketplace', 'listing', id],
    queryFn: () => marketplaceApi.getListing(id),
    enabled: Boolean(id),
  })

  // One view per page open; the server also de-duplicates per visitor per day and skips the owner.
  const viewed = useRef<string | null>(null)
  const loadedId = listingQuery.data?.item.id
  const isOwnerView = listingQuery.data?.item.isOwner
  useEffect(() => {
    if (!loadedId || isOwnerView || viewed.current === loadedId) return
    viewed.current = loadedId
    marketplaceApi.recordView(loadedId).catch(() => undefined)
  }, [loadedId, isOwnerView])

  if (listingQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const listing = listingQuery.data?.item
  if (listingQuery.isError || !listing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('marketplace.detail.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/marketplace">{t('marketplace.backToMarketplace')}</Link>
        </Button>
      </div>
    )
  }

  const requireSignIn = () => navigate('/sign-in', { state: { from: location.pathname } })

  const onToggleSave = async () => {
    if (!isAuthenticated) return requireSignIn()
    if (listing.isSaved) await unsave(listing.id)
    else await save(listing.id)
  }

  const onReport = () => {
    if (!isAuthenticated) return requireSignIn()
    setReportOpen(true)
  }

  return (
    <div className="space-y-6">
      <BackButton fallback="/marketplace" />

      {listing.isOwner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/50 p-4">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t('marketplace.detail.ownerBanner')}</p>
            {listing.moderationStatus !== 'APPROVED' ? (
              <p className="text-muted-foreground">
                {t(`marketplace.moderation.${listing.moderationStatus}`)}
                {listing.moderationNote ? ` — ${listing.moderationNote}` : ''}
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/marketplace/my/listings/${listing.id}/edit`}>
              <Pencil aria-hidden />
              {t('marketplace.actions.edit')}
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Gallery listing={listing} />

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link to={`/marketplace/search?categoryId=${listing.category.id}`} className="hover:underline">
                {categoryLabel(listing.category, i18n.language)}
              </Link>
              {listing.subcategory ? (
                <>
                  {' › '}
                  <Link
                    to={`/marketplace/search?categoryId=${listing.category.id}&subcategoryId=${listing.subcategory.id}`}
                    className="hover:underline"
                  >
                    {categoryLabel(listing.subcategory, i18n.language)}
                  </Link>
                </>
              ) : null}
            </p>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">{listing.title}</h1>
            <p className="text-3xl font-bold text-primary">{formatPrice(listing.price)}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-muted px-3 py-1">{t(`marketplace.condition.${listing.condition}`)}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                <MapPin className="size-3.5" aria-hidden />
                {[listing.locationDetail, listing.city.name].filter(Boolean).join(', ')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                <Truck className="size-3.5" aria-hidden />
                {t(`marketplace.pickup.${listing.pickupMethod}`)}
              </span>
            </div>
          </div>

          {listing.status === 'SOLD' ? (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/60 p-4 text-sm">
              <PackageCheck className="size-5 shrink-0" aria-hidden />
              {t('marketplace.detail.soldNotice', { date: formatDate(listing.soldAt) })}
            </div>
          ) : !listing.isOwner ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t('marketplace.detail.contactSeller')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ContactSellerButtons listingId={listing.id} methods={listing.contactMethods} />
              </CardContent>
            </Card>
          ) : null}

          {listing.status !== 'SOLD' && !listing.isOwner ? <AskSellerCard listingId={listing.id} /> : null}

          {listing.canReview ? <ReviewSellerForm listing={listing} /> : null}

          <div className="flex flex-wrap gap-2">
            {listing.status !== 'SOLD' && !listing.isOwner ? (
              <Button type="button" variant="outline" aria-pressed={listing.isSaved} disabled={isToggling} onClick={() => void onToggleSave()}>
                <Heart className={cn(listing.isSaved && 'fill-primary text-primary')} aria-hidden />
                {listing.isSaved ? t('marketplace.saved') : t('marketplace.save')}
              </Button>
            ) : null}
            {!listing.isOwner ? (
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onReport}>
                <Flag aria-hidden />
                {t('marketplace.report.listingAction')}
              </Button>
            ) : null}
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t('marketplace.fields.description')}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{listing.description}</p>
            <p className="text-xs text-muted-foreground">
              {t('marketplace.detail.listedOn', { date: formatDate(listing.publishedAt ?? listing.createdAt) })}
            </p>
          </section>

          {listing.movingOutSale ? (
            <Link
              to={`/marketplace/moving-out-sales/${listing.movingOutSale.id}`}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm hover:bg-primary/10"
            >
              <Truck className="size-4 text-primary" aria-hidden />
              {t('marketplace.detail.partOfSale', { title: listing.movingOutSale.title })}
            </Link>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('marketplace.detail.sellerInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <SellerAvatar name={listing.seller.name} path={listing.seller.profilePicturePath} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{listing.seller.name}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                    {listing.seller.rating.average != null
                      ? t('marketplace.seller.rating', { rating: listing.seller.rating.average.toFixed(1), count: listing.seller.rating.count })
                      : t('marketplace.seller.noRatings')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('marketplace.seller.joined', { date: formatDate(listing.seller.joinedAt) })} ·{' '}
                    {t('marketplace.seller.soldCount', { count: listing.seller.soldListingCount })}
                  </p>
                </div>
              </div>
              <SellerBadges badges={listing.seller.badges} showDescriptions />
              <Button asChild variant="outline" className="w-full">
                <Link to={`/marketplace/sellers/${listing.seller.id}`}>{t('marketplace.seller.viewProfile')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReportDialog open={reportOpen} target={{ listingId: listing.id }} onDismiss={() => setReportOpen(false)} />
    </div>
  )
}
