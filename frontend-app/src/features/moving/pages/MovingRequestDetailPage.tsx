import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { movingApi } from '../api/moving-api'

export function MovingRequestDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()

  const requestQuery = useQuery({
    queryKey: ['moving-request', id],
    enabled: Boolean(id),
    queryFn: () => movingApi.getById(id),
  })

  if (requestQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (requestQuery.isError || !requestQuery.data?.movingRequest) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t('moving.detailError')}</p>
        <Button type="button" variant="outline" onClick={() => void requestQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const request = requestQuery.data.movingRequest

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackButton fallback="/hire-moving" />
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">{t('moving.detailTitle')}</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('moving.orderNumber')}: {request.orderNumber ?? request.id}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('moving.statusLabel')}: {request.status}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <DetailRow label={t('moving.pickupAddress')} value={request.pickupAddress} />
          <DetailRow label={t('moving.dropoffAddress')} value={request.dropoffAddress} />
          <DetailRow label={t('moving.pickupFloor')} value={request.pickupFloorLevel?.name ?? '—'} />
          <DetailRow label={t('moving.dropoffFloor')} value={request.dropoffFloorLevel?.name ?? '—'} />
          <DetailRow
            label={t('moving.moveInDate')}
            value={request.moveInDate ? new Date(request.moveInDate).toLocaleDateString() : '—'}
          />
          <DetailRow label={t('moving.vehicleType')} value={request.vehicleType?.name ?? '—'} />
          {typeof request.estimatedPrice === 'number' ? (
            <DetailRow label={t('moving.estimatedPrice')} value={`${request.estimatedPrice.toLocaleString()} MMK`} />
          ) : null}
          {typeof request.distanceKm === 'number' ? (
            <DetailRow label={t('moving.distance')} value={`${request.distanceKm} km`} />
          ) : null}
          <DetailRow label={t('moving.damageChecklist')} value={request.damageChecklist ?? '—'} />
          <DetailRow label={t('moving.remarks')} value={request.remarks ?? '—'} />
          {typeof request.estimatedEarnings === 'number' ? (
            <DetailRow
              label={t('moving.estimatedEarnings')}
              value={String(request.estimatedEarnings)}
            />
          ) : null}

          <section className="space-y-2">
            <h2 className="font-medium">{t('moving.photosTitle')}</h2>
            {request.photos.length === 0 ? (
              <p className="text-muted-foreground">{t('moving.emptyPhotos')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.photos.map((photo) => {
                  const src = resolvePublicUploadUrl(photo.photoPath) ?? photo.photoPath
                  return (
                    <li
                      key={photo.id ?? photo.photoPath}
                      className="aspect-[4/3] overflow-hidden rounded-md border border-input bg-muted"
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-medium">{t('moving.inventoryTitle')}</h2>
            {request.inventoryItems.length === 0 ? (
              <p className="text-muted-foreground">{t('moving.emptyInventory')}</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {request.inventoryItems.map((item) => (
                  <li key={`${item.category}-${item.itemName}`}>
                    [{item.category}] {item.itemName}: {item.count}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{value}</p>
    </div>
  )
}
