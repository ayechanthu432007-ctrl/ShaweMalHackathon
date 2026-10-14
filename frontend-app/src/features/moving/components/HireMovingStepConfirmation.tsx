import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { movingApi } from '../api/moving-api'
import type { MovingRequest } from '../types'

function formatMmk(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString()} MMK`
}

/**
 * The booking as saved on the server. It is read back by id, so a refresh or a reopened link
 * shows the same details; the record returned when the booking was made is shown meanwhile.
 */
export function HireMovingStepConfirmation({ requestId, initial }: { requestId: string; initial?: MovingRequest | null }) {
  const { t, i18n } = useTranslation()
  const requestQuery = useQuery({
    queryKey: ['moving-request', requestId],
    queryFn: () => movingApi.getById(requestId),
    initialData: initial ? { movingRequest: initial } : undefined,
  })
  const request = requestQuery.data?.movingRequest

  if (!request) {
    return requestQuery.isError ? (
      <p className="text-sm text-destructive">{t('moving.confirmationLoadFailed')}</p>
    ) : (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    )
  }

  const moveDate = request.moveInDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(request.moveInDate))
    : '—'

  const bookingRows = [
    { label: t('moving.pickupAddress'), value: request.pickupAddress || '—' },
    { label: t('moving.dropoffAddress'), value: request.dropoffAddress || '—' },
    { label: t('moving.vehicleType'), value: request.vehicleType?.name ?? '—' },
    { label: t('moving.totalPrice'), value: formatMmk(request.estimatedPrice), strong: true },
    { label: t('moving.moveInDate'), value: moveDate },
  ]
  const contactRows = [
    { label: t('moving.orderNumber'), value: request.orderNumber ?? request.id },
    { label: t('moving.bookerName'), value: request.requester?.name || '—' },
    { label: t('moving.bookerPhone'), value: request.requester?.phone || '—' },
    { label: t('moving.bookerEmail'), value: request.requester?.email || '—' },
  ]

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('moving.confirmationTitle')}</h2>
        <p className="flex items-start gap-2 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          {t('moving.successMessage')}
        </p>
      </div>

      <dl aria-label={t('moving.bookingDetails')} className="divide-y rounded-xl border">
        {bookingRows.map((row) => (
          <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
            <dt className="font-semibold">{row.label}</dt>
            <dd className={row.strong ? 'break-words text-base font-bold text-primary' : 'break-words'}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3">
        <dl aria-label={t('moving.orderInformation')} className="space-y-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
          {contactRows.map((row) => (
            <div key={row.label} className="grid gap-0.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-bold">{row.label}</dt>
              <dd className="break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground">{t('moving.driverContactNotice')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/moving-status/${request.id}`}>{t('moving.trackStatus')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/hire-moving/${request.id}`}>{t('moving.viewRequest')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">{t('nav.home')}</Link>
        </Button>
      </div>
    </div>
  )
}
