import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceRatingForm } from '@/features/reviews/components/ServiceRatingForm'

import { profileApi } from '../api/profile-api'

export function HistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [openRatingId, setOpenRatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const historyQuery = useQuery({
    queryKey: ['profile-history'],
    enabled: isAuthenticated,
    queryFn: () => profileApi.history(),
  })

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  if (historyQuery.isLoading) {
    return <LoadingState />
  }

  if (historyQuery.isError || !historyQuery.data) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold text-destructive">{t('profile.historyError')}</h1>
        <Button type="button" variant="outline" onClick={() => void historyQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const { bookingHistory, movingHistory, notifications } = historyQuery.data

  return (
    <div className="space-y-6">
      <BackLink to="/profile" label={t('nav.profile')} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.history')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.historySubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.bookingHistory')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bookingHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.emptyBookings')}</p>
          ) : (
            bookingHistory.map((booking) => {
              const canRate = booking.status.toUpperCase() === 'CONFIRMED'
              const ratingKey = `booking:${booking.id}`
              return (
                <div key={booking.id} className="space-y-3 rounded-md border p-3 text-sm">
                  <p className="font-medium">{booking.house?.title ?? booking.id}</p>
                  <p className="text-muted-foreground">
                    {booking.status} · {new Date(booking.createdAt).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {booking.house?.id ? (
                      <Link className="text-primary underline-offset-2 hover:underline" to={`/houses/${booking.house.id}`}>
                        {t('houses.details')}
                      </Link>
                    ) : null}
                    {canRate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenRatingId((current) => (current === ratingKey ? null : ratingKey))}
                      >
                        {booking.myReview ? t('reviews.update') : t('reviews.rate')}
                      </Button>
                    ) : null}
                  </div>
                  {canRate && openRatingId === ratingKey ? (
                    <ServiceRatingForm
                      source={{ bookingId: booking.id }}
                      targetKind="agent"
                      targetName={booking.house?.agent?.name}
                      existing={booking.myReview}
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.movingHistory')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {movingHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.emptyMoving')}</p>
          ) : (
            movingHistory.map((item) => {
              const canRate = item.status === 'COMPLETED' && Boolean(item.assignedDriver)
              const ratingKey = `moving:${item.id}`
              return (
                <div key={item.id} className="space-y-3 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {item.orderNumber ?? item.id}: {item.pickupAddress} → {item.dropoffAddress}
                  </p>
                  <p className="text-muted-foreground">
                    {item.status} · {item.vehicleType?.name ?? '—'} ·{' '}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.assignedDriver ? (
                    <p className="text-muted-foreground">
                      {t('profile.assignedDriver')}: {item.assignedDriver.name}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link className="text-primary underline-offset-2 hover:underline" to={`/moving-status/${item.id}`}>
                      {t('moving.trackStatus')}
                    </Link>
                    {canRate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenRatingId((current) => (current === ratingKey ? null : ratingKey))}
                      >
                        {item.myReview ? t('reviews.update') : t('reviews.rate')}
                      </Button>
                    ) : null}
                  </div>
                  {canRate && openRatingId === ratingKey ? (
                    <ServiceRatingForm
                      source={{ movingRequestId: item.id }}
                      targetKind="driver"
                      targetName={item.assignedDriver?.name}
                      existing={item.myReview}
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('nav.notifications')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('profile.notificationSummary', {
              total: notifications.total,
              unread: notifications.unread,
            })}
          </p>
          {notifications.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
          ) : (
            notifications.recent.map((item) => (
              <div key={item.id} className="rounded-md border p-3 text-sm">
                <p className={item.isRead ? 'font-normal' : 'font-semibold'}>{item.title}</p>
                <p className="text-muted-foreground">{item.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
