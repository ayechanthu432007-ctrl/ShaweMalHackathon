import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'
import { movingApi } from '@/features/moving/api/moving-api'

import { AdminMovingRequestDetails } from '../components/AdminMovingRequestDetails'

export function AdminMovingRequestDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()

  const detailQuery = useQuery({
    queryKey: ['admin', 'moving-request', id],
    enabled: Boolean(id),
    queryFn: () => movingApi.getById(id),
  })

  if (detailQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('common.loading')}
      </p>
    )
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
        <p className="text-sm text-destructive">{t('admin.movingReport.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/admin/reports/moving">{t('admin.movingReport.backToList')}</Link>
        </Button>
      </div>
    )
  }

  if (detailQuery.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('admin.movingReport.detailError')}</p>
        <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
          {t('common.retry')}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/admin/reports/moving">{t('admin.movingReport.backToList')}</Link>
        </Button>
      </div>
    )
  }

  const request = detailQuery.data?.movingRequest
  if (!request) {
    return null
  }

  return (
    <section className="space-y-6">
      <BackLink to="/admin/reports/moving" label={t('admin.movingReport.backToList')} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('admin.movingReport.detailTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('moving.orderNumber')}: {request.orderNumber ?? request.id}
        </p>
      </div>

      <AdminMovingRequestDetails request={request} />
    </section>
  )
}
