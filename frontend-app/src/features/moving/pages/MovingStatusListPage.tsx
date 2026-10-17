import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'

import { movingApi } from '../api/moving-api'
import { MovingStatusBookingList } from '../components/MovingStatusBookingList'

export function MovingStatusListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const listQuery = useQuery({
    queryKey: ['moving-requests-mine'],
    enabled: isAuthenticated,
    queryFn: () => movingApi.listMine(),
  })

  const items = listQuery.data?.items ?? []

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  if (listQuery.isLoading) {
    return <LoadingState />
  }

  if (listQuery.isError) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold text-destructive">{t('moving.statusListError')}</h1>
        <Button type="button" variant="outline" onClick={() => void listQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.movingStatus')}</h1>
        <p className="text-sm text-muted-foreground">{t('moving.statusEmpty')}</p>
        <Button asChild>
          <Link to="/hire-moving">{t('nav.hireMoving')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('nav.movingStatus')}</h1>
        <p className="text-sm text-muted-foreground">{t('moving.statusSubtitle')}</p>
      </div>

      <MovingStatusBookingList items={items} />
    </div>
  )
}
