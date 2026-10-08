import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceRatingForm } from '@/features/reviews/components/ServiceRatingForm'
import { ApiRequestError } from '@/lib/api/client'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { bookingsApi } from '../api/bookings-api'
import { housesApi } from '../api/houses-api'
import { BookHouseDialog } from '../components/BookHouseDialog'
import { CancelBookingDialog } from '../components/CancelBookingDialog'
import { HouseAvailabilityBadge } from '../components/HouseAvailabilityBadge'
import { HouseLocationMap } from '../components/HouseLocationMap'
import { useWishlist } from '../hooks/useWishlist'
import { isHouseAvailable } from '../lib/availability'

function formatFees(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} MMK`
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

  return (
    <section className="space-y-6">
      {/* History back keeps the Finding House filters, which live in the URL. */}
      <BackButton fallback="/finding-house" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{house.title}</h1>
          <div className="mt-2">
            <HouseAvailabilityBadge availability={house.availability} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {[
              house.location.streetAddress,
              house.location.city?.name,
              house.location.state?.name,
              house.propertyType?.name,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={isToggling} onClick={() => void onToggleWishlist()}>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {house.images.length > 0 ? (
          house.images.map((image) => {
            const src = resolvePublicUploadUrl(image.imagePath) ?? image.imagePath
            return (
              <div key={image.id ?? image.imagePath} className="aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                <img src={src} alt={house.title} className="h-full w-full object-cover" />
              </div>
            )
          })
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            {t('houses.noPhoto')}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('houses.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap text-muted-foreground">
              {house.description?.trim() || t('houses.noDescription')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-medium">{t('houses.availability')}: </span>
                {isHouseAvailable(house.availability) ? t('houses.available') : t('houses.notAvailable')}
              </p>
              <p>
                <span className="font-medium">{t('houses.monthlyFeesLabel')}: </span>
                {formatFees(house.monthlyFees)}
              </p>
              <p>
                <span className="font-medium">{t('houses.depositLabel')}: </span>
                {formatFees(house.depositAmount)}
              </p>
              <p>
                <span className="font-medium">{t('houses.bedrooms')}: </span>
                {house.bedrooms}
              </p>
              <p>
                <span className="font-medium">{t('houses.bathrooms')}: </span>
                {house.bathrooms}
              </p>
              {house.areaSize ? (
                <p>
                  <span className="font-medium">{t('houses.areaSize')}: </span>
                  {house.areaSize}
                </p>
              ) : null}
              {house.contractType?.name ? (
                <p>
                  <span className="font-medium">{t('houses.contractType')}: </span>
                  {house.contractType.name}
                </p>
              ) : null}
            </div>
            {house.amenities.length > 0 ? (
              <div>
                <p className="mb-2 font-medium">{t('houses.amenities')}</p>
                <ul className="flex flex-wrap gap-2">
                  {house.amenities.map((amenity) => (
                    <li key={amenity.id} className="rounded-md bg-muted px-2 py-1 text-xs">
                      {amenity.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {house.location.nearbyPlaces ? (
              <p>
                <span className="font-medium">{t('houses.nearbyPlaces')}: </span>
                {house.location.nearbyPlaces}
              </p>
            ) : null}
            {house.houseRules ? (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">{t('houses.houseRules')}: </span>
                {house.houseRules}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('houses.agentDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{house.agent.name}</p>
            {house.agent.phone ? <p>{house.agent.phone}</p> : null}
            {house.agent.email ? <p>{house.agent.email}</p> : null}
            {house.contact.phone ? (
              <p>
                <span className="font-medium">{t('houses.contactPhone')}: </span>
                {house.contact.phone}
              </p>
            ) : null}
            {myConfirmedBooking ? (
              <ServiceRatingForm
                className="border-t border-border pt-4"
                source={{ bookingId: myConfirmedBooking.id }}
                targetKind="agent"
                targetName={house.agent.name}
                existing={myConfirmedBooking.myReview}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            {t('houses.mapTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {house.location.streetAddress ? (
            <p className="text-sm">
              <span className="font-medium">{t('houses.streetAddress')}: </span>
              {house.location.streetAddress}
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
