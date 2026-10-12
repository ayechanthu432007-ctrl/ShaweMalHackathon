import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  Bath,
  BedDouble,
  Building2,
  CalendarClock,
  CircleCheck,
  Heart,
  Layers,
  MapPin,
  Ruler,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceRatingForm } from '@/features/reviews/components/ServiceRatingForm'
import { trackHouseEvent } from '@/features/agent/api/agent-plan-api'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { bookingsApi } from '../api/bookings-api'
import { housesApi } from '../api/houses-api'
import { AgentContactCard } from '../components/AgentContactCard'
import { BookHouseDialog } from '../components/BookHouseDialog'
import { CancelBookingDialog } from '../components/CancelBookingDialog'
import { HouseAvailabilityBadge } from '../components/HouseAvailabilityBadge'
import { HouseGallery } from '../components/HouseGallery'
import { amenityIcon, amenityLabel, nearbyPlaceIcon, splitNearbyPlaces } from '../components/house-icons'
import { HouseLocationMap } from '../components/HouseLocationMap'
import { useWishlist } from '../hooks/useWishlist'
import { isHouseAvailable } from '../lib/availability'

function formatFees(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} MMK`
}

/** One labelled fact with its icon, used in the overview and details grids. */
function HouseFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-semibold leading-tight">{value}</dd>
      </div>
    </div>
  )
}

export function HouseDetailsPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const { wishlistedIds, add, remove, isToggling } = useWishlist()
  const [bookError, setBookError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const detailsQuery = useQuery({
    queryKey: ['houses', id],
    enabled: Boolean(id),
    queryFn: () => housesApi.getById(id),
  })

  // One view per visit to this page; the server ignores repeats from the same visitor that day.
  const loadedHouseId = detailsQuery.data?.item.id
  useEffect(() => {
    if (loadedHouseId) trackHouseEvent(loadedHouseId, 'VIEW')
  }, [loadedHouseId])

  const myBookingsQuery = useQuery({
    queryKey: ['my-bookings'],
    enabled: isAuthenticated,
    queryFn: () => bookingsApi.listMine(),
  })

  const bookMutation = useMutation({
    mutationFn: () => housesApi.book(id),
    onSuccess: async (result) => {
      setBookError(null)
      setBookDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      navigate(`/houses/${id}/bookings/${result.booking.id}/confirmation`)
    },
    onError: (error) => {
      setBookDialogOpen(false)
      if (error instanceof ApiRequestError) {
        setBookError(error.message)
        return
      }
      setBookError(t('houses.bookFailed'))
    },
  })

  const house = detailsQuery.data?.item
  const isWishlisted = Boolean(house && wishlistedIds.has(house.id))
  const myActiveBooking = myBookingsQuery.data?.items.find(
    (item) => item.houseId === id && item.status.toUpperCase() !== 'CANCELLED',
  )
  const myConfirmedBooking =
    myActiveBooking?.status.toUpperCase() === 'CONFIRMED' ? myActiveBooking : undefined

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => bookingsApi.updateStatus(bookingId, 'CANCELLED'),
    onSuccess: async () => {
      setCancelError(null)
      setCancelDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (error) => {
      setCancelError(error instanceof ApiRequestError ? error.message : t('houses.cancelFailed'))
    },
  })

  const onBook = () => {
    if (!isAuthenticated) {
      navigate('/sign-in', { state: { from: `/houses/${id}` } })
      return
    }
    setBookError(null)
    setBookDialogOpen(true)
  }

  const onToggleWishlist = async () => {
    if (!house) return
    if (!isAuthenticated) {
      navigate('/sign-in', { state: { from: `/houses/${id}`, authPrompt: 'wishlist' } })
      return
    }
    if (isWishlisted) {
      await remove(house.id)
      return
    }
    await add(house.id)
  }

  if (detailsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (detailsQuery.isError || !house) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{t('houses.detailsError')}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void detailsQuery.refetch()}>
            {t('common.retry')}
          </Button>
          <Button asChild variant="secondary">
            <Link to="/finding-house">{t('houses.backToList')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const locationLine = [house.location.streetAddress, house.location.city?.name, house.location.state?.name].filter(Boolean).join(', ')
  const nearbyPlaces = splitNearbyPlaces(house.location.nearbyPlaces)

  return (
    <section className="space-y-6">
      {/* History back keeps the Finding House filters, which live in the URL. */}
      <BackButton fallback="/finding-house" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <HouseAvailabilityBadge availability={house.availability} />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{house.title}</h1>
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{locationLine || t('houses.locationUnknown')}</span>
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatFees(house.monthlyFees)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">{t('houses.perMonth')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={isToggling} aria-pressed={isWishlisted} onClick={() => void onToggleWishlist()}>
            <Heart className={cn(isWishlisted && 'fill-primary text-primary')} aria-hidden />
            {isWishlisted ? t('houses.removeWishlist') : t('houses.addWishlist')}
          </Button>
          {myActiveBooking ? (
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(true)}>
              {t('houses.cancelBooking')}
            </Button>
          ) : (
            <Button type="button" disabled={bookMutation.isPending} onClick={onBook}>
              {t('houses.bookNow')}
            </Button>
          )}
        </div>
      </div>

      {bookError ? <p className="text-sm text-destructive">{bookError}</p> : null}
      {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}

      <BookHouseDialog
        open={bookDialogOpen}
        houseTitle={house.title}
        isPending={bookMutation.isPending}
        onDismiss={() => {
          if (!bookMutation.isPending) {
            setBookDialogOpen(false)
          }
        }}
        onConfirm={() => {
          void bookMutation.mutateAsync()
        }}
      />

      <CancelBookingDialog
        open={cancelDialogOpen && Boolean(myActiveBooking)}
        houseTitle={house.title}
        isPending={cancelMutation.isPending}
        onDismiss={() => {
          if (!cancelMutation.isPending) {
            setCancelDialogOpen(false)
          }
        }}
        onConfirm={() => {
          if (myActiveBooking) {
            void cancelMutation.mutateAsync(myActiveBooking.id)
          }
        }}
      />

      <HouseGallery title={house.title} images={house.images} />

      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('houses.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <section className="space-y-3" aria-label={t('houses.overview')}>
              <h3 className="text-sm font-semibold">{t('houses.overview')}</h3>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <HouseFact icon={BedDouble} label={t('houses.bedrooms')} value={house.bedrooms} />
                <HouseFact icon={Bath} label={t('houses.bathrooms')} value={house.bathrooms} />
                {house.areaSize ? <HouseFact icon={Ruler} label={t('houses.areaSize')} value={house.areaSize} /> : null}
                {house.propertyType?.name ? (
                  <HouseFact icon={Building2} label={t('houses.propertyType')} value={house.propertyType.name} />
                ) : null}
              </dl>
            </section>

            <section className="space-y-3" aria-label={t('houses.costsAndTerms')}>
              <h3 className="text-sm font-semibold">{t('houses.costsAndTerms')}</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                <HouseFact icon={Banknote} label={t('houses.monthlyFeesLabel')} value={formatFees(house.monthlyFees)} />
                <HouseFact icon={Wallet} label={t('houses.depositLabel')} value={formatFees(house.depositAmount)} />
                {house.contractType?.name ? (
                  <HouseFact icon={CalendarClock} label={t('houses.contractType')} value={house.contractType.name} />
                ) : null}
                {house.floorLevel?.name ? <HouseFact icon={Layers} label={t('houses.floorLevel')} value={house.floorLevel.name} /> : null}
                <HouseFact
                  icon={CircleCheck}
                  label={t('houses.availability')}
                  value={isHouseAvailable(house.availability) ? t('houses.available') : t('houses.notAvailable')}
                />
              </dl>
            </section>

            <section className="space-y-2" aria-label={t('houses.description')}>
              <h3 className="text-sm font-semibold">{t('houses.description')}</h3>
              <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {house.description?.trim() || t('houses.noDescription')}
              </p>
            </section>

            {house.amenities.length > 0 ? (
              <section className="space-y-3" aria-label={t('houses.amenities')}>
                <h3 className="text-sm font-semibold">{t('houses.amenities')}</h3>
                <ul className="flex flex-wrap gap-2">
                  {house.amenities.map((amenity) => {
                    const Icon = amenityIcon(amenity.name)
                    return (
                      <li key={amenity.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium">
                        <Icon className="size-3.5 text-primary" aria-hidden />
                        {amenityLabel(amenity.name)}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {nearbyPlaces.length > 0 ? (
              <section className="space-y-3" aria-label={t('houses.nearbyPlaces')}>
                <h3 className="text-sm font-semibold">{t('houses.nearbyPlaces')}</h3>
                <ul className="flex flex-wrap gap-2">
                  {nearbyPlaces.map((place) => {
                    const Icon = nearbyPlaceIcon(place)
                    return (
                      <li key={place} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
                        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                        {place}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {house.houseRules ? (
              <section className="space-y-2" aria-label={t('houses.houseRules')}>
                <h3 className="text-sm font-semibold">{t('houses.houseRules')}</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{house.houseRules}</p>
              </section>
            ) : null}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-4">
          <AgentContactCard house={house}>
            {myConfirmedBooking ? (
              <ServiceRatingForm
                className="border-t border-border pt-4"
                source={{ bookingId: myConfirmedBooking.id }}
                targetKind="agent"
                targetName={house.agent.name}
                existing={myConfirmedBooking.myReview}
              />
            ) : null}
          </AgentContactCard>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            {t('houses.mapTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {house.location.streetAddress ? (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-xs text-muted-foreground">{t('houses.streetAddress')}</span>
                <span className="font-medium">{house.location.streetAddress}</span>
              </span>
            </p>
          ) : null}
          <HouseLocationMap
            streetAddress={house.location.streetAddress}
            cityName={house.location.city?.name}
            stateName={house.location.state?.name}
            latitude={house.location.latitude}
            longitude={house.location.longitude}
          />
        </CardContent>
      </Card>
    </section>
  )
}
