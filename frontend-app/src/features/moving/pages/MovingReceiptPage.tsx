import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Globe, Printer } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import logo from '@/assets/shawemal-logo.png'
import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'

import { movingApi } from '../api/moving-api'
import { assignedDriverName, completionDate } from '../lib/moving-status'
import type { MovingRequest } from '../types'

const isAmount = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
const mmk = (value: number) => `MMK ${Math.round(value).toLocaleString()}`

/** Only the rows the booking actually has a value for. */
function receiptRows(request: MovingRequest, t: (key: string, options?: Record<string, unknown>) => string) {
  const distance = isAmount(request.distanceKm) && request.distanceKm > 0 ? request.distanceKm : null
  const rate = isAmount(request.pricePerKmUsed) ? request.pricePerKmUsed : null
  const movingCost = distance !== null && rate !== null ? Math.round(rate * distance * 100) / 100 : null
  const floorCharges = (request.pickupFloorSurcharge ?? 0) + (request.dropoffFloorSurcharge ?? 0)
  const doneAt = completionDate(request)
  const driver = assignedDriverName(request)

  const rows: Array<{ label: string; value: string }> = [
    { label: t('moving.receiptNumber'), value: request.orderNumber ?? request.id },
    ...(driver ? [{ label: t('moving.statusDriverName'), value: driver }] : []),
    ...(request.vehicleType?.name ? [{ label: t('moving.receiptVehicle'), value: request.vehicleType.name }] : []),
    { label: t('moving.receiptPickup'), value: request.pickupAddress },
    { label: t('moving.receiptDestination'), value: request.dropoffAddress },
    ...(distance !== null ? [{ label: t('moving.receiptDistance'), value: `${distance.toLocaleString()} km` }] : []),
    ...(rate !== null ? [{ label: t('moving.receiptRate'), value: `${mmk(rate)} / km` }] : []),
    ...(movingCost !== null ? [{ label: t('moving.receiptMovingCost'), value: mmk(movingCost) }] : []),
    ...(floorCharges > 0 ? [{ label: t('moving.receiptAdditional'), value: mmk(floorCharges) }] : []),
    ...(doneAt
      ? [{ label: t('moving.receiptCompletionDate'), value: new Date(doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) }]
      : []),
  ]
  return rows
}

export function MovingReceiptPage() {
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

  if (isBootstrapping || !isAuthenticated || detailQuery.isLoading) {
    return <LoadingState />
  }

  const request = detailQuery.data?.movingRequest
  if (!request) {
    const notFound = detailQuery.error instanceof ApiRequestError && detailQuery.error.status === 404
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{notFound ? t('moving.statusNotFound') : t('moving.detailError')}</p>
        <Button asChild variant="outline">
          <Link to="/moving-status">{t('moving.statusBackToList')}</Link>
        </Button>
      </div>
    )
  }

  // A receipt only exists once the move is finished; anything else goes back to tracking.
  if (request.status !== 'COMPLETED') {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <p className="text-sm text-muted-foreground">{t('moving.receiptNotReady')}</p>
        <Button asChild>
          <Link to={`/moving-status/${request.id}`}>{t('moving.statusCheckStatus')}</Link>
        </Button>
      </div>
    )
  }

  const rows = receiptRows(request, t)
  const total = isAmount(request.estimatedPrice) ? request.estimatedPrice : null
  const website = window.location.origin

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink to="/moving-status" label={t('moving.statusBackToList')} />
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          {t('moving.printReceipt')}
        </Button>
      </div>

      <article id="moving-receipt" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-10" aria-labelledby="receipt-title">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <img src={logo} alt="" className="size-12 rounded-lg object-contain sm:size-16" />
            <div>
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">Shawe Mal</p>
              <h1 id="receipt-title" className="text-base text-muted-foreground sm:text-lg">
                {t('moving.receiptTitle')}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t('moving.receiptTagline')}</p>
        </header>

        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-5 py-2 text-xl font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="size-6" aria-hidden />
            {t('moving.receiptCompleted')}
          </span>
          <p className="mt-3 text-sm text-muted-foreground">{t('moving.receiptCompletedMessage')}</p>
          <p className="text-sm text-muted-foreground">{t('moving.receiptThanksShort')}</p>
        </div>

        {total !== null ? (
          <div className="mt-6 rounded-2xl bg-muted/60 px-4 py-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('moving.receiptTotalCost')}</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{mmk(total)}</p>
          </div>
        ) : null}

        <dl className="mt-8 divide-y text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 py-2.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-words font-medium">{row.value}</dd>
            </div>
          ))}
          {total !== null ? (
            <div className="grid gap-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-semibold">{t('moving.receiptTotalCost')}</dt>
              <dd className="text-base font-bold">{mmk(total)}</dd>
            </div>
          ) : null}
        </dl>

        <footer className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('moving.receiptThankYou')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('moving.receiptThankYouBody')}</p>
            <p className="mt-3 text-sm font-semibold italic text-primary">{t('moving.receiptJourney')}</p>
          </div>
          <div className="text-sm sm:border-l sm:pl-6">
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="size-4" aria-hidden />
              {t('moving.receiptVisitWebsite')}
            </p>
            <a href={website} className="font-medium text-primary hover:underline">
              {website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        </footer>
      </article>
    </div>
  )
}
