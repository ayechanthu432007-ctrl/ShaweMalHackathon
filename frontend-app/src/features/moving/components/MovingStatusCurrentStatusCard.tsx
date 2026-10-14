import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle2, Phone, ReceiptText, Shield, Truck, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'

import { movingApi } from '../api/moving-api'

import {
  assignedDriverPhone,
  latestEtaForStage,
  remainingMinutes,
  timelineIndexForStatus,
  MOVING_TIMELINE_STEPS,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'
import { MovingCancelDialog } from './MovingCancelDialog'
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
  // Mirrors the server rule: only a booking still waiting for a driver. The server checks again.
  const canCancel = request.status === 'BOOKED' && !request.assignedDriver
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelledNote, setCancelledNote] = useState(false)
  const cancelMutation = useMutation({
    mutationFn: () => movingApi.cancel(request.id),
    onSuccess: async (result) => {
      queryClient.setQueryData(['moving-request', request.id], result)
      await queryClient.invalidateQueries({ queryKey: ['moving-requests-mine'] })
      setCancelOpen(false)
      setCancelledNote(true)
    },
    onError: (error) => {
      setCancelError(error instanceof ApiRequestError ? error.message : t('moving.cancelFailed'))
      // The booking may have moved on (a driver accepted), so show its current state.
      void queryClient.invalidateQueries({ queryKey: ['moving-request', request.id] })
    },
  })

  const title = isCancelled ? t('moving.statusBadge.CANCELLED') : t(`moving.statusStep.${step?.id ?? 'booking_confirmed'}.title`)

  return (
    <>
      {/* Fixed to the bottom of the window while this page is open; it unmounts with the page.
          It floats inside the page width and stops short of the Telegram/Viber buttons on the right. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 sm:px-6"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <section
          aria-labelledby="moving-current-status-title"
          className="pointer-events-auto mx-auto mr-[4.5rem] max-w-6xl overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:mr-24 xl:mx-auto"
        >
          <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/20" aria-hidden="true" />
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-5 sm:p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <div className="relative shrink-0">
                <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-md sm:size-14">
                  <Truck className="size-5 sm:size-6" aria-hidden="true" />
                </div>
                {!isCancelled && request.status !== 'COMPLETED' ? (
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5" aria-hidden="true">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-3.5 rounded-full border-2 border-card bg-emerald-500" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('moving.statusCurrentTitle')}</p>
                  {etaAt ? (
                    <p className="text-xs font-semibold text-primary">
                      {minutes
                        ? t('moving.statusEtaMinutes', { minutes })
                        : t('moving.statusEtaAt', {
                            time: new Date(etaAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
                          })}
                    </p>
                  ) : null}
                </div>
                <h2 id="moving-current-status-title" className="text-lg font-bold leading-tight tracking-tight sm:text-xl">
                  {title}
                </h2>
                {cancelledNote ? (
                  <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                    {t('moving.cancelSuccess')}
                  </p>
                ) : null}
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {isCancelled ? t('moving.statusCancelledBody') : t(`moving.statusStep.${step?.id ?? 'booking_confirmed'}.detail`)}
                </p>
              </div>
            </div>
            {!isCancelled ? (
              <p className="hidden max-w-xs items-start gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs leading-snug text-muted-foreground lg:flex">
                <Shield className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                {t(`moving.statusStep.${step?.id ?? 'booking_confirmed'}.alert`)}
              </p>
            ) : null}
            <div className="flex shrink-0 flex-wrap gap-2">
              {/* Only the final step, Move Completed, has a receipt. */}
              {request.status === 'COMPLETED' ? (
                <Button asChild className="h-10 rounded-full px-5 font-semibold shadow-md shadow-primary/25">
                  <Link to={`/moving-status/${request.id}/receipt`}>
                    <ReceiptText className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t('moving.viewReceipt')}
                  </Link>
                </Button>
              ) : null}
              {phone ? (
                <Button asChild className="h-10 rounded-full px-5 font-semibold shadow-md shadow-primary/25">
                  <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                    <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t('moving.contactDriver')}
                  </a>
                </Button>
              ) : (
                <Button type="button" className="h-10 rounded-full px-5 font-semibold" disabled>
                  <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('moving.contactDriver')}
                </Button>
              )}
              {request.assignedDriver ? (
                <Button type="button" variant="outline" className="h-10 rounded-full px-5" onClick={() => setDriverDetailsOpen(true)}>
                  {t('moving.statusDriverDetails')}
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-destructive/40 px-5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setCancelError(null)
                    setCancelOpen(true)
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('moving.cancelBooking')}
                </Button>
              ) : null}
              {canRateDriver ? (
                <Button type="button" variant="outline" className="h-10 rounded-full px-5" onClick={() => setRateDriverOpen(true)}>
                  {request.myReview ? t('moving.statusUpdateDriverRating') : t('moving.statusRateDriver')}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <MovingCancelDialog
        open={cancelOpen}
        orderNumber={request.orderNumber ?? request.id}
        isPending={cancelMutation.isPending}
        error={cancelError}
        onDismiss={() => setCancelOpen(false)}
        onConfirm={() => {
          if (!cancelMutation.isPending) cancelMutation.mutate()
        }}
      />
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
