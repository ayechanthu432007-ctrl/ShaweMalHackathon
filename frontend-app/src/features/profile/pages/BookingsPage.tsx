import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { PageSkeleton } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { BackLink } from '@/components/common/BackButton'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { bookingsApi } from '@/features/houses/api/bookings-api'
import type { HouseBooking } from '@/features/houses/types/booking'

type BookingFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'
type BookingStatus = Exclude<BookingFilter, 'ALL'> | 'UNKNOWN'

const bookingFilters: BookingFilter[] = ['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED']

function statusFor(booking: HouseBooking): BookingStatus {
  const status = booking.status.toUpperCase()
  return status === 'PENDING' || status === 'CONFIRMED' || status === 'CANCELLED' ? status : 'UNKNOWN'
}

function statusTone(status: BookingStatus): BadgeTone {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'CANCELLED') return 'neutral'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

export function BookingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [activeFilter, setActiveFilter] = useState<BookingFilter>('ALL')

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const bookingsQuery = useQuery({
    queryKey: ['my-bookings'],
    enabled: isAuthenticated,
    queryFn: () => bookingsApi.listMine(),
  })

  const bookings = bookingsQuery.data?.items ?? []
  const counts = useMemo(
    () => ({
      ALL: bookings.length,
      PENDING: bookings.filter((booking) => statusFor(booking) === 'PENDING').length,
      CONFIRMED: bookings.filter((booking) => statusFor(booking) === 'CONFIRMED').length,
      CANCELLED: bookings.filter((booking) => statusFor(booking) === 'CANCELLED').length,
    }),
    [bookings],
  )
  const visibleBookings = activeFilter === 'ALL' ? bookings : bookings.filter((booking) => statusFor(booking) === activeFilter)

  if (isBootstrapping || !isAuthenticated || bookingsQuery.isLoading) return <PageSkeleton />

  if (bookingsQuery.isError) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold text-destructive">{t('profile.bookings.loadError')}</h1>
        <Button type="button" variant="outline" onClick={() => void bookingsQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <BackLink to="/profile" label={t('nav.profile')} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('profile.bookings.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('profile.bookings.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {bookingFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
            className={`rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeFilter === filter ? 'border-primary ring-1 ring-primary/20' : ''
            }`}
          >
            <span className="block text-sm text-muted-foreground">{t(`profile.bookings.filters.${filter}`)}</span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums">{counts[filter]}</span>
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <h2 className="text-lg font-semibold">{t('profile.bookings.emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('profile.bookings.emptyBody')}</p>
            <Button asChild>
              <Link to="/finding-house">{t('nav.findingHouse')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : visibleBookings.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t('profile.bookings.filteredEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleBookings.map((booking) => {
            const status = statusFor(booking)
            const houseTitle = booking.house?.title ?? t('profile.bookings.houseUnavailable')
            const locationText = [booking.house?.city?.name, booking.house?.state?.name].filter(Boolean).join(', ')
            const createdAt = new Date(booking.createdAt)
            const createdDate = Number.isNaN(createdAt.getTime()) ? null : createdAt.toLocaleDateString()
            return (
              <Card key={booking.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold sm:text-lg">{houseTitle}</h2>
                      <Badge tone={statusTone(status)}>{t(`profile.bookings.status.${status}`)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {locationText || t('houses.locationUnknown')}
                      {createdDate ? <> · {t('profile.bookings.requestedOn', { date: createdDate })}</> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{t(`profile.bookings.statusHelp.${status}`)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {booking.house?.id ? (
                      <Button asChild variant="outline">
                        <Link to={`/houses/${booking.house.id}`}>{t('profile.bookings.viewHouse')}</Link>
                      </Button>
                    ) : null}
                    {booking.houseId ? (
                      <Button asChild>
                        <Link to={`/houses/${booking.houseId}/bookings/${booking.id}/confirmation`}>
                          {t('profile.bookings.viewBooking')}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
