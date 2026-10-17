import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { bookingsApi } from '../api/bookings-api'

export function BookingConfirmationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id: houseId = '', bookingId = '' } = useParams()
  const { isAuthenticated, isBootstrapping } = useAuth()

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const bookingQuery = useQuery({
    queryKey: ['booking', bookingId],
    enabled: isAuthenticated && Boolean(bookingId),
    queryFn: () => bookingsApi.getById(bookingId),
  })

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  if (bookingQuery.isLoading) {
    return <LoadingState />
  }

  if (bookingQuery.isError || !bookingQuery.data?.booking) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <h1 className="text-base font-semibold text-destructive">{t('houses.confirmation.loadError')}</h1>
        <Button type="button" variant="outline" onClick={() => void bookingQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const booking = bookingQuery.data.booking
  const resolvedHouseId = booking.house?.id ?? houseId

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">{t('houses.confirmation.title')}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t('houses.confirmation.thankYou')}</p>
          <p className="text-sm">
            {t('houses.confirmation.houseLabel')}:{' '}
            <span className="font-medium">{booking.house?.title ?? resolvedHouseId}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('houses.confirmation.statusLabel')}: {booking.status}
          </p>
          <div className="rounded-lg border bg-muted/40 p-4">
            <h2 className="text-lg font-semibold tracking-tight">{t('houses.movingUpsell.title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('houses.confirmation.movingOffer')}</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" asChild>
                <Link to={`/houses/${resolvedHouseId}`}>{t('houses.movingUpsell.no')}</Link>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('bookingId', booking.id)
                  params.set('houseId', resolvedHouseId)
                  navigate(`/hire-moving?${params.toString()}`)
                }}
              >
                {t('houses.movingUpsell.yes')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
