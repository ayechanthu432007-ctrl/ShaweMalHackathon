import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, ChevronRight, Heart, Home, MessageCircle, Phone, Send, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { ServiceRatingForm } from '@/features/reviews/components/ServiceRatingForm'
import { trackHouseEvent } from '@/features/agent/api/agent-plan-api'
import { ApiRequestError } from '@/lib/api/client'
import { telegramProfileLink, viberChatLink } from '@/lib/contact-links'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
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

  const callNumber = house.contact.phone || house.agent.phone || null
  const telegram = telegramProfileLink(house.contact.telegram)
  const viber = viberChatLink(house.contact.viber ?? '')

  // Only what the listing actually states; rows without a value are left out.
  const priceRows: Array<{ label: string; value: string }> = [
    { label: t('houses.monthlyFeesLabel'), value: formatFees(house.monthlyFees) },
    { label: t('houses.depositLabel'), value: formatFees(house.depositAmount) },
    ...(hasInternet ? [{ label: t('houses.internet'), value: t('houses.internetIncluded') }] : []),
    ...(house.contractType?.name ? [{ label: t('houses.contractType'), value: house.contractType.name }] : []),
    ...(house.floorLevel?.name ? [{ label: t('houses.floorLevel'), value: house.floorLevel.name }] : []),
  ]

  const sectionTitle = 'border-b-2 border-highlight pb-2 text-2xl font-bold capitalize tracking-tight'
  const roomTypeTitle = 'border-b-2 border-highlight pb-2 text-2xl font-bold capitalize tracking-tight'
  const sideTitle = 'border-b-2 border-highlight pb-2 text-2xl font-bold capitalize tracking-tight'
  const amenityRow = 'flex items-center gap-4 py-2.5 text-[0.95rem]'

  return (
    <section className="space-y-4">
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

      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          {/* ---------- main column ---------- */}
          <div className="min-w-0">
            <header>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{house.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{locationLine || t('houses.locationUnknown')}</p>

              <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] sm:gap-0">
                <div className="space-y-4 sm:pr-5">
                  {callNumber || telegram || viber ? (
                    <div className="grid grid-cols-2 gap-3">
                      {callNumber ? (
                        <a
                          href={`tel:${callNumber.replace(/[^\d+]/g, '')}`}
                          onClick={() => trackHouseEvent(house.id, 'CALL')}
                          className={cn(
                            'flex h-14 items-center justify-center gap-2 rounded-xl border border-[#D5E2F0] bg-[#EAF2FA] px-2 text-sm font-semibold text-[#24476A] xl:text-base transition-colors hover:bg-[#DCEAF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border dark:bg-button-soft dark:text-button-soft-foreground dark:hover:bg-button-soft-hover',
                            !(telegram || viber) && 'col-span-2',
                          )}
                        >
                          <Phone className="size-5 shrink-0" aria-hidden />
                          <span className="truncate">{callNumber}</span>
                        </a>
                      ) : null}
                      {telegram || viber ? (
                        <a
                          href={(telegram ?? viber) as string}
                          {...(telegram ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          onClick={() => trackHouseEvent(house.id, telegram ? 'TELEGRAM' : 'VIBER')}
                          className={cn(
                            'flex h-14 items-center justify-center gap-2 rounded-xl bg-[#7360F2] px-2 text-sm font-bold uppercase xl:text-base tracking-wide text-white shadow-md shadow-[#7360F2]/25 transition-colors hover:bg-[#5E4BD1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7360F2] focus-visible:ring-offset-2',
                            !callNumber && 'col-span-2',
                          )}
                        >
                          {telegram ? <Send className="size-5 shrink-0" aria-hidden /> : <MessageCircle className="size-5 shrink-0" aria-hidden />}
                          <span aria-hidden>{telegram ? 'Telegram' : 'Viber'}</span>
                          <span className="sr-only">{telegram ? t('houses.chatOnTelegram') : t('houses.chatOnViber')}</span>
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {myActiveBooking ? (
                    <Button type="button" variant="outline" className="h-14 w-full border-highlight text-base text-primary hover:bg-primary/10 hover:text-primary" onClick={() => setCancelDialogOpen(true)}>
                      {t('houses.cancelBooking')}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 w-full border-highlight text-base text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={bookMutation.isPending || !available}
                      onClick={onBook}
                    >
                      <Bookmark className="size-5" aria-hidden />
                      {t('houses.bookNow')}
                    </Button>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {house.propertyType?.name ? (
                      <span className="inline-flex items-center gap-2">
                        <Home className="size-5" aria-hidden />
                        {house.propertyType.name}
                      </span>
                    ) : null}
                    <HouseAvailabilityBadge availability={house.availability} />
                    <span className="ml-auto flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" disabled={isToggling} aria-pressed={isWishlisted} onClick={() => void onToggleWishlist()}>
                        <Heart className={cn(isWishlisted && 'fill-primary text-primary')} aria-hidden />
                        {isWishlisted ? t('houses.saved') : t('houses.save')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void onShare()}>
                        <Share2 aria-hidden />
                        {t('houses.share')}
                      </Button>
                    </span>
                  </div>

                  {!available && !myActiveBooking ? <p className="text-xs text-muted-foreground">{t('houses.notAvailableNote')}</p> : null}
                  {shareNote ? (
                    <p className="break-all text-xs text-muted-foreground" role="status">
                      {shareNote}
                    </p>
                  ) : null}
                  {bookError ? <p className="text-sm text-destructive">{bookError}</p> : null}
                  {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
                </div>

                <div className="sm:border-l sm:pl-7">
                  <p className="text-sm text-muted-foreground">
                    {t('houses.rentalRate')}
                    <span aria-hidden> :</span>
                  </p>
                  <p className="mt-2 text-2xl font-bold text-primary sm:text-[1.75rem]">
                    {formatFees(house.monthlyFees)}
                    <span>/{t('houses.monthUnit')}</span>
                  </p>
                  <p className="mt-2 text-lg font-bold text-muted-foreground">{t('houses.depositFor', { amount: formatFees(house.depositAmount) })}</p>
                </div>
              </div>
            </header>

            <div className="mt-8">
              <HouseGallery title={house.title} images={house.images} />
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-2">
              <section aria-labelledby="house-description-title">
                <h2 id="house-description-title" className="text-xl font-medium">
                  {t('houses.description')}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{house.description?.trim() || t('houses.noDescription')}</p>
                {house.houseRules ? (
                  <>
                    <h3 className="mt-6 text-base font-medium">{t('houses.houseRules')}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{house.houseRules}</p>
                  </>
                ) : null}
              </section>

              <dl aria-label={t('houses.pricingDetails')} className="self-start rounded-2xl bg-primary/10 px-6 pb-8 pt-6 text-sm">
                <div className="border-b-2 border-primary/25" />
                {priceRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-2 gap-3 border-b-2 border-primary/25 px-3 pb-1.5 pt-6">
                    <dt className="text-muted-foreground">{row.label} :</dt>
                    <dd className="text-muted-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <section className="mt-12" aria-labelledby="house-room-type-title">
              <h2 id="house-room-type-title" className={roomTypeTitle}>
                {t('houses.roomType')}
              </h2>
              <div className="mt-6 overflow-x-auto rounded-xl border border-l-4 border-l-highlight bg-card px-6 py-6 shadow-md">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="pb-2 pr-4 font-bold">{t('houses.propertyType')}</th>
                      <th scope="col" className="pb-2 pr-4 font-bold">{t('houses.roomType')}</th>
                      <th scope="col" className="pb-2 pr-4 font-bold">{t('houses.areaSize')}</th>
                      <th scope="col" className="pb-2 pr-4 font-bold">{t('houses.contractType')}</th>
                      <th scope="col" className="pb-2 pr-4 font-bold">{t('houses.monthlyFeesLabel')}</th>
                      <th scope="col" className="pb-2 font-bold">{t('houses.roomStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-muted-foreground">
                      <td className="pr-4">{house.propertyType?.name ?? '—'}</td>
                      <td className="pr-4">{t('houses.roomsSummary', { bedrooms: house.bedrooms, bathrooms: house.bathrooms })}</td>
                      <td className="pr-4">{house.areaSize || '—'}</td>
                      <td className="pr-4">{house.contractType?.name ?? '—'}</td>
                      <td className="pr-4">
                        {formatFees(house.monthlyFees)} / {t('houses.monthUnit')}
                      </td>
                      <td>
                        <span className={cn('inline-block rounded-full px-3 py-1', available ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>{availabilityText}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {house.amenities.length > 0 || missingAmenities.length > 0 ? (
              <section className="mt-14" aria-labelledby="house-amenities-title">
                <h2 id="house-amenities-title" className={sectionTitle}>
                  {t('houses.amenities')}
                </h2>
                <div className="mt-4 px-4">
                  {house.amenities.length > 0 ? (
                    <ul className="grid gap-x-8 sm:grid-cols-2" aria-label={t('houses.amenitiesIncluded')}>
                      {house.amenities.map((amenity) => {
                        const Icon = amenityIcon(amenity.name)
                        return (
                          <li key={amenity.id} className={cn(amenityRow, 'text-muted-foreground')}>
                            <Icon className="size-6 shrink-0 text-primary" aria-hidden />
                            <span>{amenityLabel(amenity.name)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">{t('houses.noAmenities')}</p>
                  )}
                  {missingAmenities.length > 0 ? (
                    <ul className="grid gap-x-8 sm:grid-cols-2" aria-label={t('houses.amenitiesNotIncluded')}>
                      {missingAmenities.map((amenity) => {
                        const Icon = amenityIcon(amenity.name)
                        return (
                          <li key={amenity.id} className={cn(amenityRow, 'text-muted-foreground/60')}>
                            <Icon className="size-6 shrink-0 text-primary/35" aria-hidden />
                            <span className="line-through">{amenityLabel(amenity.name)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="mt-12" aria-labelledby="house-map-title">
              <h2 id="house-map-title" className={sectionTitle}>
                {t('houses.mapTitle')}
              </h2>
              <div className="mt-6 overflow-hidden rounded-2xl px-0 sm:px-4">
                <HouseLocationMap
                  streetAddress={house.location.streetAddress}
                  cityName={house.location.city?.name}
                  stateName={house.location.state?.name}
                  latitude={house.location.latitude}
                  longitude={house.location.longitude}
                />
              </div>
            </section>
          </div>

          {/* ---------- sidebar ---------- */}
          <aside className="min-w-0 space-y-10">
            {nearbyPlaces.length > 0 ? (
              <section aria-labelledby="house-nearby-title">
                <h2 id="house-nearby-title" className={sideTitle}>
                  {t('houses.nearbyPlaces')}
                </h2>
                <ul className="mt-5 space-y-3">
                  {nearbyPlaces.map((place) => {
                    const Icon = nearbyPlaceIcon(place)
                    return (
                      <li key={place} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5 text-sm font-semibold text-muted-foreground shadow-sm">
                        <Icon className="size-5 shrink-0" aria-hidden />
                        <span>{place}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {related.length > 0 ? (
              <section aria-labelledby="related-houses-title">
                <h2 id="related-houses-title" className={sideTitle}>
                  {t('houses.relatedTitle')}
                </h2>
                <ul className="mt-3 divide-y">
                  {related.map((item) => {
                    const thumbnail = item.thumbnail ? (resolvePublicUploadUrl(item.thumbnail) ?? item.thumbnail) : null
                    const place = [item.city?.name, item.state?.name].filter(Boolean).join(', ')
                    return (
                      <li key={item.id}>
                        <Link to={`/houses/${item.id}`} className="group flex gap-4 rounded-md p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs text-muted-foreground">
                            {thumbnail ? <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" /> : t('houses.noPhoto')}
                          </span>
                          <span className="min-w-0 space-y-1">
                            <span className="line-clamp-2 block font-bold leading-snug text-sky-700 group-hover:underline dark:text-sky-400">{item.title}</span>
                            {place ? <span className="block text-sm text-muted-foreground">{place}</span> : null}
                            <span className="block text-sm font-bold">
                              {formatFees(item.monthlyFees)}/{t('houses.monthUnit')}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

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
        </div>
      </div>

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
