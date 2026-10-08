import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'

import { movingApi } from '../api/moving-api'
import { MovingStatusBookingDetails } from '../components/MovingStatusBookingDetails'
import { MovingStatusCurrentMoveCard } from '../components/MovingStatusCurrentMoveCard'
import { MovingStatusCurrentStatusCard } from '../components/MovingStatusCurrentStatusCard'
import { MovingStatusSafetyCard } from '../components/MovingStatusSafetyCard'
import { MovingStatusTimeline } from '../components/MovingStatusTimeline'

export function MovingStatusPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id = '' } = useParams()
  const { isAuthenticated, isBootstrapping } = useAuth()

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const detailQuery = useQuery({
    queryKey: ['moving-request', id],
    enabled: isAuthenticated && Boolean(id),
    queryFn: () => movingApi.getById(id),
  })

  if (isBootstrapping || !isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (detailQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const isNotFound =
    !id ||
    (detailQuery.isError &&
      detailQuery.error instanceof ApiRequestError &&
      detailQuery.error.status === 404) ||
    (detailQuery.isSuccess && !detailQuery.data?.movingRequest)

  if (isNotFound) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('moving.statusNotFound')}</p>
        <Button asChild variant="outline">
          <Link to="/moving-status">{t('moving.statusBackToList')}</Link>
        </Button>
      </div>
    )
  }

  if (detailQuery.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('moving.detailError')}</p>
        <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
          {t('common.retry')}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/moving-status">{t('moving.statusBackToList')}</Link>
        </Button>
      </div>
    )
  }

  const request = detailQuery.data?.movingRequest
  if (!request) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink to="/moving-status" label={t('moving.statusBackToList')} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('nav.movingStatus')}</h1>
        <p className="text-sm text-muted-foreground">{t('moving.statusSubtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MovingStatusCurrentMoveCard request={request} />
        <MovingStatusCurrentStatusCard request={request} />
      </div>
      <MovingStatusTimeline request={request} />
      <div className="grid gap-6 lg:grid-cols-2">
        <MovingStatusBookingDetails request={request} />
        <MovingStatusSafetyCard />
      </div>
    </div>
  )
}
