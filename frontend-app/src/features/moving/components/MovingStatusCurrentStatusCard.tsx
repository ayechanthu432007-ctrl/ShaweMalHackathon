import { useState } from 'react'
import { Phone, Shield, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  assignedDriverPhone,
  latestEtaForStage,
  remainingMinutes,
  timelineIndexForStatus,
  MOVING_TIMELINE_STEPS,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'
import { MovingStatusDriverDetailsDialog } from './MovingStatusDriverDetailsDialog'
import { MovingStatusRateDriverDialog } from './MovingStatusRateDriverDialog'

export function MovingStatusCurrentStatusCard({ request }: { request: MovingRequest }) {
  const { t } = useTranslation()
  const [driverDetailsOpen, setDriverDetailsOpen] = useState(false)
  const [rateDriverOpen, setRateDriverOpen] = useState(false)
  const stepIndex = timelineIndexForStatus(request.status)
  const step = stepIndex >= 0 ? MOVING_TIMELINE_STEPS[stepIndex] : null
  const etaAt = latestEtaForStage(request.etaEntries, step?.etaStage ?? null)
  const minutes = etaAt ? remainingMinutes(etaAt) : null
  const phone = assignedDriverPhone(request)
  const isCancelled = request.status === 'CANCELLED'
  const canRateDriver = request.status === 'COMPLETED' && Boolean(request.assignedDriver)

  const title = isCancelled ? t('moving.statusBadge.CANCELLED') : t(`moving.statusStep.${step?.id ?? 'booking_confirmed'}.title`)

  return (
    <>
      {/* Fixed to the bottom of the window while this page is open; it unmounts with the page. */}
      <section
        aria-labelledby="moving-current-status-title"
        className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-primary bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 py-3 pl-4 pr-20 sm:flex-row sm:items-center sm:gap-5 sm:py-4 sm:pr-24 lg:pl-6">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/20 sm:size-14">
              <Truck className="size-5 sm:size-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-primary">{t('moving.statusCurrentTitle')}</p>
              <h2 id="moving-current-status-title" className="text-lg font-bold leading-tight sm:text-xl">
                {title}
              </h2>
              {etaAt ? (
                <p className="text-sm font-medium text-primary">
                  {minutes
                    ? t('moving.statusEtaMinutes', { minutes })
                    : t('moving.statusEtaAt', {
                        time: new Date(etaAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
                      })}
                </p>
              ) : null}
              <p className="line-clamp-1 text-sm text-muted-foreground sm:line-clamp-2">
                {isCancelled ? t('moving.statusCancelledBody') : t(`moving.statusStep.${step?.id ?? 'booking_confirmed'}.detail`)}
              </p>
              {!isCancelled ? (
                <p className="mt-1 hidden items-start gap-1.5 text-xs text-foreground/80 md:flex">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {t(`moving.statusStep.${step?.id ?? 'booking_confirmed'}.alert`)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {phone ? (
              <Button asChild className="h-9 px-3 sm:h-10 sm:px-4">
                <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                  <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('moving.contactDriver')}
                </a>
              </Button>
            ) : (
              <Button type="button" className="h-9 px-3 sm:h-10 sm:px-4" disabled>
                <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('moving.contactDriver')}
              </Button>
            )}
            {request.assignedDriver ? (
              <Button type="button" variant="outline" className="h-9 px-3 sm:h-10 sm:px-4" onClick={() => setDriverDetailsOpen(true)}>
                {t('moving.statusDriverDetails')}
              </Button>
            ) : null}
            {canRateDriver ? (
              <Button type="button" variant="outline" className="h-9 px-3 sm:h-10 sm:px-4" onClick={() => setRateDriverOpen(true)}>
                {request.myReview ? t('moving.statusUpdateDriverRating') : t('moving.statusRateDriver')}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      {request.assignedDriver ? (
        <MovingStatusDriverDetailsDialog
          open={driverDetailsOpen}
          request={request}
          onDismiss={() => setDriverDetailsOpen(false)}
        />
      ) : null}
      {canRateDriver ? (
        <MovingStatusRateDriverDialog
          open={rateDriverOpen}
          request={request}
          onDismiss={() => setRateDriverOpen(false)}
        />
      ) : null}
    </>
  )
}
