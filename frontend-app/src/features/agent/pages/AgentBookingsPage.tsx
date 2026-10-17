import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'
import { bookingsApi } from '@/features/houses/api/bookings-api'

import { agentBookingsApi } from '../api/agent-bookings-api'

function isActiveBooking(status: string): boolean {
  return status.toUpperCase() !== 'CANCELLED'
}

export function AgentBookingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const isAgent = Boolean(user?.roles?.includes('agent'))

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const bookingsQuery = useQuery({
    queryKey: ['agent-bookings'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => agentBookingsApi.list(),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.updateStatus(id, 'CANCELLED'),
    onSuccess: async () => {
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['agent-bookings'] })
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('agent.bookings.cancelFailed'))
    },
  })

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  if (!isAgent) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('agent.bookings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.roleRequired')}</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('agent.bookings.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agent.bookings.subtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/agent/houses">{t('agent.houses.title')}</Link>
        </Button>
      </div>

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      {bookingsQuery.isLoading ? <LoadingState /> : null}

      {bookingsQuery.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{t('agent.bookings.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void bookingsQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {bookingsQuery.data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">{t('agent.bookings.empty')}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {bookingsQuery.data?.items.map((booking) => (
          <Card key={booking.id}>
            <CardHeader>
              <CardTitle className="text-lg">{booking.house?.title ?? booking.houseId}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                {t('agent.bookings.status')}: {booking.status}
              </p>
              <p>
                {t('agent.bookings.bookedAt')}: {new Date(booking.createdAt).toLocaleString()}
              </p>
              <div className="rounded-md bg-muted/50 p-3">
                <p className="font-medium">{t('agent.bookings.bookerDetails')}</p>
                <p>{booking.user?.name ?? '—'}</p>
                <p>{booking.user?.email ?? '—'}</p>
                <p>{booking.user?.phone ?? '—'}</p>
              </div>
              {booking.status.toUpperCase() === 'CANCELLED' ? (
                <p className="text-muted-foreground">
                  {t('agent.bookings.cancelledBy', { actor: booking.cancelledByRole ?? '—' })}
                </p>
              ) : null}
              {isActiveBooking(booking.status) ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t('agent.bookings.cancelConfirm'))) {
                      void cancelMutation.mutateAsync(booking.id)
                    }
                  }}
                >
                  {t('houses.cancelBooking')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
