import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  Bath,
  BedDouble,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleCheck,
  Heart,
  Layers,
  MapPin,
  Ruler,
  Share2,
  Wallet,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
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
import { HouseCard } from '../components/HouseCard'
import { HouseGallery } from '../components/HouseGallery'
import { amenityIcon, amenityLabel, nearbyPlaceIcon, splitNearbyPlaces } from '../components/house-icons'
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

  // One view per visit to this page; the server ignores repeats from the same visitor that day.
  const loadedHouseId = detailsQuery.data?.item.id
  useEffect(() => {
    if (loadedHouseId) trackHouseEvent(loadedHouseId, 'VIEW')
  }, [loadedHouseId])

  const relatedQuery = useQuery({
    queryKey: ['houses', id, 'related'],
    enabled: Boolean(id),
    queryFn: () => housesApi.related(id),
  })

  // The whole amenity catalogue, so the page can also say what this home does not have.
  const amenityCatalogQuery = useQuery({
    queryKey: ['master-data', 'amenities'],
    queryFn: () => masterDataApi.list('amenities'),
    staleTime: 10 * 60 * 1000,
  })

  const [shareNote, setShareNote] = useState<string | null>(null)

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

  const onShare = async () => {
    const url = window.location.href
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: house?.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareNote(t('houses.linkCopied'))
    } catch (error) {
      // Closing the share sheet is not a failure; anything else falls back to showing the link.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareNote(t('houses.linkCopyFailed', { url }))
    }
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
  const available = isHouseAvailable(house.availability)
  const availabilityText = available ? t('houses.available') : t('houses.notAvailable')
  const hasInternet = house.amenities.some((amenity) => /wi-?fi|internet/i.test(amenity.name))
  const includedIds = new Set(house.amenities.map((amenity) => amenity.id))
  const missingAmenities = (amenityCatalogQuery.data?.items ?? []).filter((amenity) => !includedIds.has(amenity.id))
  const related = (relatedQuery.data?.items ?? []).filter((item) => item.id !== house.id)

  const keyFacts: Array<{ icon: LucideIcon; text: string }> = [
    { icon: BedDouble, text: t('houses.bedCount', { count: house.bedrooms }) },
    { icon: Bath, text: t('houses.bathCount', { count: house.bathrooms }) },
    ...(house.areaSize ? [{ icon: Ruler, text: house.areaSize }] : []),
    ...(house.floorLevel?.name ? [{ icon: Layers, text: house.floorLevel.name }] : []),
  ]

  // Only what the listing actually states; rows without a value are left out.
  const infoRows: Array<{ icon: LucideIcon; label: string; value: string | number }> = [
    ...(house.propertyType?.name ? [{ icon: Building2, label: t('houses.propertyType'), value: house.propertyType.name }] : []),
    { icon: BedDouble, label: t('houses.bedrooms'), value: house.bedrooms },
    { icon: Bath, label: t('houses.bathrooms'), value: house.bathrooms },
    ...(house.areaSize ? [{ icon: Ruler, label: t('houses.areaSize'), value: house.areaSize }] : []),
    ...(house.floorLevel?.name ? [{ icon: Layers, label: t('houses.floorLevel'), value: house.floorLevel.name }] : []),
    { icon: Banknote, label: t('houses.monthlyFeesLabel'), value: formatFees(house.monthlyFees) },
    { icon: Wallet, label: t('houses.depositLabel'), value: formatFees(house.depositAmount) },
    ...(house.contractType?.name ? [{ icon: CalendarClock, label: t('houses.contractType'), value: house.contractType.name }] : []),
    ...(hasInternet ? [{ icon: Wifi, label: t('houses.internet'), value: t('houses.internetIncluded') }] : []),
    { icon: CircleCheck, label: t('houses.availability'), value: availabilityText },
  ]

  const sectionTitle = 'text-lg font-semibold tracking-tight'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* History back keeps the Finding House filters, which live in the URL. */}
        <BackButton fallback="/finding-house" />
        <nav aria-label={t('houses.breadcrumb')} className="min-w-0 text-sm text-muted-foreground">
          <ol className="flex min-w-0 items-center gap-1">
            <li>
              <Link to="/" className="whitespace-nowrap hover:text-foreground hover:underline">
                {t('nav.home')}
              </Link>
            </li>
            <li className="flex shrink-0 items-center gap-1">
              <ChevronRight className="size-3.5" aria-hidden />
              <Link to="/finding-house" className="whitespace-nowrap hover:text-foreground hover:underline">
                {t('nav.findingHouse')}
              </Link>
            </li>
            <li className="flex min-w-0 items-center gap-1" aria-current="page">
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate text-foreground">{house.title}</span>
            </li>
          </ol>
        </nav>
      </div>

      <HouseGallery title={house.title} images={house.images} />

      {/* Title first on every screen; on phones the price and actions follow straight after it. */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <HouseAvailabilityBadge availability={house.availability} />
          {house.propertyType?.name ? (
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium">
              <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
              {house.propertyType.name}
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{house.title}</h1>
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{locationLine || t('houses.locationUnknown')}</span>
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 border-y py-3 text-sm">
          {keyFacts.map((fact) => (
            <li key={fact.text} className="flex items-center gap-1.5 font-medium">
              <fact.icon className="size-4 text-muted-foreground" aria-hidden />
              {fact.text}
            </li>
          ))}
        </ul>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------- actions: beside the content on desktop, directly under the photos on phones ---------- */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:order-last">
          <Card className="shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs text-muted-foreground">{t('houses.rentalRate')}</p>
                <p className="text-3xl font-bold leading-tight text-primary">
                  {formatFees(house.monthlyFees)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">{t('houses.perMonth')}</span>
                </p>
              </div>
              <dl className="space-y-1.5 border-y py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('houses.depositLabel')}</dt>
                  <dd className="font-medium">{formatFees(house.depositAmount)}</dd>
                </div>
                {house.contractType?.name ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t('houses.contractType')}</dt>
                    <dd className="font-medium">{house.contractType.name}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="space-y-2">
                {myActiveBooking ? (
                  <Button type="button" variant="outline" className="w-full" onClick={() => setCancelDialogOpen(true)}>
                    {t('houses.cancelBooking')}
                  </Button>
                ) : (
                  <Button type="button" className="w-full" disabled={bookMutation.isPending || !available} onClick={onBook}>
                    {t('houses.bookNow')}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" disabled={isToggling} aria-pressed={isWishlisted} onClick={() => void onToggleWishlist()}>
                    <Heart className={cn(isWishlisted && 'fill-primary text-primary')} aria-hidden />
                    {isWishlisted ? t('houses.saved') : t('houses.save')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void onShare()}>
                    <Share2 aria-hidden />
                    {t('houses.share')}
                  </Button>
                </div>
              </div>

              {!available && !myActiveBooking ? <p className="text-xs text-muted-foreground">{t('houses.notAvailableNote')}</p> : null}
              {shareNote ? (
                <p className="break-all text-xs text-muted-foreground" role="status">
                  {shareNote}
                </p>
              ) : null}
              {bookError ? <p className="text-sm text-destructive">{bookError}</p> : null}
              {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
            </CardContent>
          </Card>

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
        </aside>

        {/* ---------- main content ---------- */}
        <div className="min-w-0 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t('houses.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <section className="space-y-2" aria-label={t('houses.description')}>
                <h3 className="text-sm font-semibold">{t('houses.description')}</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{house.description?.trim() || t('houses.noDescription')}</p>
              </section>

              <section className="space-y-2" aria-label={t('houses.propertyInformation')}>
                <h3 className="text-sm font-semibold">{t('houses.propertyInformation')}</h3>
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  {infoRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 border-b py-2.5">
                      <dt className="flex items-center gap-2 text-muted-foreground">
                        <row.icon className="size-4 shrink-0" aria-hidden />
                        {row.label}
                      </dt>
                      <dd className="text-right font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {house.houseRules ? (
                <section className="space-y-2" aria-label={t('houses.houseRules')}>
                  <h3 className="text-sm font-semibold">{t('houses.houseRules')}</h3>
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{house.houseRules}</p>
                </section>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                {t('houses.roomType')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">{t('houses.propertyType')}</th>
                      <th scope="col" className="py-2 pr-4 font-medium">{t('houses.rooms')}</th>
                      <th scope="col" className="py-2 pr-4 font-medium">{t('houses.areaSize')}</th>
                      <th scope="col" className="py-2 pr-4 font-medium">{t('houses.contractType')}</th>
                      <th scope="col" className="py-2 pr-4 font-medium">{t('houses.monthlyFeesLabel')}</th>
                      <th scope="col" className="py-2 font-medium">{t('houses.roomStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 pr-4 font-medium">{house.propertyType?.name ?? '—'}</td>
                      <td className="py-3 pr-4">{t('houses.roomsSummary', { bedrooms: house.bedrooms, bathrooms: house.bathrooms })}</td>
                      <td className="py-3 pr-4">{house.areaSize || '—'}</td>
                      <td className="py-3 pr-4">{house.contractType?.name ?? '—'}</td>
                      <td className="py-3 pr-4 font-medium text-primary">{formatFees(house.monthlyFees)}</td>
                      <td className="py-3">
                        <HouseAvailabilityBadge availability={house.availability} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {house.amenities.length > 0 || missingAmenities.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  {t('houses.amenities')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {house.amenities.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('houses.amenitiesIncluded')}>
                    {house.amenities.map((amenity) => {
                      const Icon = amenityIcon(amenity.name)
                      return (
                        <li key={amenity.id} className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 font-medium">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{amenityLabel(amenity.name)}</span>
                          <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t('houses.noAmenities')}</p>
                )}
                {missingAmenities.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('houses.amenitiesNotIncluded')}</p>
                    <ul className="flex flex-wrap gap-1.5" aria-label={t('houses.amenitiesNotIncluded')}>
                      {missingAmenities.map((amenity) => (
                        <li key={amenity.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground line-through decoration-muted-foreground/50">
                          <X className="size-3" aria-hidden />
                          {amenityLabel(amenity.name)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                {t('houses.mapTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              {nearbyPlaces.length > 0 ? (
                <section className="space-y-2" aria-label={t('houses.nearbyPlaces')}>
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
            </CardContent>
          </Card>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="space-y-3" aria-labelledby="related-houses-title">
          <div>
            <h2 id="related-houses-title" className={sectionTitle}>
              {t('houses.relatedTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('houses.relatedSubtitle')}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <HouseCard house={item} className="h-full" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
    </section>
  )
}
