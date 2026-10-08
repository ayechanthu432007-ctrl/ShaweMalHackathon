import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { movingApi } from '@/features/moving/api/moving-api'
import type { MovingRequest } from '@/features/moving/types'
import { ApiRequestError } from '@/lib/api/client'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { driverJobsApi, type DriverStatusInput } from '../api/driver-api'
import { CancelDriverJobDialog } from '../components/CancelDriverJobDialog'
import {
  canDriverCancelAssignedJob,
  getDriverNextStatus,
  getMinEtaDatetimeLocal,
  isEtaBeforeMoveInDate,
} from '../lib/driver-job-status'

const DRIVER_ETA_STAGES = [
  { value: 'driver_coming', labelKey: 'driver.statusDriverComing' },
  { value: 'driver_arrived', labelKey: 'driver.statusDriverArrived' },
  { value: 'loading', labelKey: 'driver.statusLoading' },
  { value: 'on_the_way', labelKey: 'driver.statusOnTheWay' },
  { value: 'unloading', labelKey: 'driver.statusUnloading' },
] as const

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function formatMoveInDate(value?: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function movingStatusLabel(status: string, t: (key: string, options?: Record<string, unknown>) => string) {
  return t(`moving.statusBadge.${status}`, { defaultValue: status })
}

function nextStatusLabel(nextStatus: DriverStatusInput['status'], t: (key: string, options?: Record<string, unknown>) => string) {
  return movingStatusLabel(nextStatus.toUpperCase(), t)
}

export function DriverJobsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [etaStage, setEtaStage] = useState<(typeof DRIVER_ETA_STAGES)[number]['value']>('driver_coming')
  const [etaAt, setEtaAt] = useState('')
  const [etaNotes, setEtaNotes] = useState('')
  const [cancelJobTarget, setCancelJobTarget] = useState<MovingRequest | null>(null)

  const isDriver = Boolean(user?.roles?.includes('driver'))

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const availableQuery = useQuery({
    queryKey: ['driver-requests-available'],
    enabled: isAuthenticated && isDriver && !id,
    queryFn: () => driverJobsApi.listAvailable(),
  })

  const assignedQuery = useQuery({
    queryKey: ['driver-requests-assigned'],
    enabled: isAuthenticated && isDriver && !id,
    queryFn: () => driverJobsApi.listAssigned(),
  })

  const detailQuery = useQuery({
    queryKey: ['moving-request', id],
    enabled: isAuthenticated && isDriver && Boolean(id),
    queryFn: () => movingApi.getById(id!),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['driver-requests-available'] })
    await queryClient.invalidateQueries({ queryKey: ['driver-requests-assigned'] })
    if (id) await queryClient.invalidateQueries({ queryKey: ['moving-request', id] })
  }

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => driverJobsApi.accept(requestId),
    onSuccess: async (result) => {
      setActionSuccess(t('driver.acceptSuccess'))
      setActionError(null)
      await invalidate()
      navigate(`/driver/jobs/${result.movingRequest.id}`)
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('driver.actionFailed'))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => driverJobsApi.reject(requestId),
    onSuccess: async () => {
      setActionSuccess(t('driver.rejectSuccess'))
      setActionError(null)
      await invalidate()
      if (id) navigate('/driver/jobs')
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('driver.actionFailed'))
    },
  })

  const etaMutation = useMutation({
    mutationFn: () =>
      driverJobsApi.addEta(id!, {
        stage: etaStage.trim(),
        etaAt: new Date(etaAt).toISOString(),
        notes: etaNotes.trim() || undefined,
      }),
    onSuccess: async () => {
      setActionSuccess(t('driver.etaSuccess'))
      setActionError(null)
      await invalidate()
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('driver.actionFailed'))
    },
  })

  const statusMutation = useMutation({
    mutationFn: (nextStatus: DriverStatusInput['status']) =>
      driverJobsApi.updateStatus(id!, {
        status: nextStatus,
      }),
    onSuccess: async (_result, nextStatus) => {
      setActionSuccess(
        t('driver.statusUpdatedTo', { status: nextStatusLabel(nextStatus, t) }),
      )
      setActionError(null)
      await invalidate()
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('driver.actionFailed'))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      driverJobsApi.updateStatus(requestId, {
        status: 'cancelled',
        notes: reason,
      }),
    onSuccess: async () => {
      setCancelJobTarget(null)
      setActionSuccess(t('driver.cancelSuccess'))
      setActionError(null)
      await invalidate()
      if (id) {
        navigate('/driver/jobs')
      }
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('driver.actionFailed'))
    },
  })

  if (isBootstrapping || !isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (!isDriver) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">{t('driver.jobsTitle')}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('driver.roleRequired')}</p>
          <Button asChild variant="outline">
            <Link to="/driver-register">{t('nav.driverRegister')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (id) {
    if (detailQuery.isLoading) {
      return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    }
    if (detailQuery.isError || !detailQuery.data?.movingRequest) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{t('driver.detailError')}</p>
          <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )
    }

    const request = detailQuery.data.movingRequest
    const isAssignedToMe = request.assignedDriver?.id === user?.id
    const canRespond = request.status === 'BOOKED' && !request.assignedDriver
    const nextStatus = getDriverNextStatus(request.status)
    const minEtaAt = getMinEtaDatetimeLocal(request.moveInDate)

    return (
      <div className="space-y-4">
        <BackLink to="/driver/jobs" label={t('driver.backToJobs')} />
        <div>
          <h1 className="text-2xl font-semibold">{t('driver.jobDetailTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('moving.orderNumber')}: {request.orderNumber ?? request.id}
          </p>
        </div>

        {canRespond ? (
          <Card className="mx-auto max-w-3xl">
            <CardContent className="space-y-4 p-6 text-sm">
              <p>
                <span className="font-medium">{t('moving.pickupAddress')}: </span>
                {request.pickupAddress}
              </p>
              <p>
                <span className="font-medium">{t('moving.dropoffAddress')}: </span>
                {request.dropoffAddress}
              </p>
              <p>
                <span className="font-medium">{t('moving.moveInDate')}: </span>
                {formatMoveInDate(request.moveInDate)}
              </p>
              <p>
                <span className="font-medium">{t('moving.estimatedEarnings')}: </span>
                {request.estimatedEarnings ?? '—'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate(request.id)}
                >
                  {t('driver.accept')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(request.id)}
                >
                  {t('driver.reject')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              {isAssignedToMe ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2 className="text-lg">{t('driver.statusSection')}</h2>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <p>
                        <span className="font-medium">{t('driver.currentStatus')}: </span>
                        {movingStatusLabel(request.status, t)}
                      </p>
                      {nextStatus ? (
                        <Button
                          type="button"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate(nextStatus)}
                        >
                          {t('driver.markAsStatus', { status: nextStatusLabel(nextStatus, t) })}
                        </Button>
                      ) : (
                        <p className="text-muted-foreground">{t('driver.statusAllStepsComplete')}</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2 className="text-lg">{t('driver.etaSection')}</h2>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="space-y-2">
                        <Label htmlFor="eta-stage">{t('driver.etaStage')}</Label>
                        <select
                          id="eta-stage"
                          className={selectClassName}
                          value={etaStage}
                          onChange={(e) =>
                            setEtaStage(e.target.value as (typeof DRIVER_ETA_STAGES)[number]['value'])
                          }
                        >
                          {DRIVER_ETA_STAGES.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {t(stage.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eta-at">{t('driver.etaAt')}</Label>
                        <Input
                          id="eta-at"
                          type="datetime-local"
                          min={minEtaAt}
                          value={etaAt}
                          onChange={(e) => setEtaAt(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eta-notes">{t('driver.notes')}</Label>
                        <Input id="eta-notes" value={etaNotes} onChange={(e) => setEtaNotes(e.target.value)} />
                      </div>
                      <Button
                        type="button"
                        disabled={!etaStage.trim() || !etaAt || etaMutation.isPending}
                        onClick={() => {
                          if (isEtaBeforeMoveInDate(etaAt, request.moveInDate)) {
                            setActionError(t('driver.etaBeforeMoveIn'))
                            setActionSuccess(null)
                            return
                          }
                          setActionError(null)
                          etaMutation.mutate()
                        }}
                      >
                        {t('driver.saveEta')}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-lg">{t('driver.jobDetailTitle')}</h2>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('moving.statusLabel')}: {movingStatusLabel(request.status, t)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>
                  <span className="font-medium">{t('moving.pickupAddress')}: </span>
                  {request.pickupAddress}
                </p>
                <p>
                  <span className="font-medium">{t('moving.dropoffAddress')}: </span>
                  {request.dropoffAddress}
                </p>
                <p>
                  <span className="font-medium">{t('moving.moveInDate')}: </span>
                  {formatMoveInDate(request.moveInDate)}
                </p>
                <p>
                  <span className="font-medium">{t('moving.estimatedEarnings')}: </span>
                  {request.estimatedEarnings ?? '—'}
                </p>
                <p>
                  <span className="font-medium">{t('driver.customerName')}: </span>
                  {request.requester?.name ?? '—'}
                </p>
                <p>
                  <span className="font-medium">{t('driver.customerPhone')}: </span>
                  {request.requester?.phone ?? '—'}
                </p>
                <p>
                  <span className="font-medium">{t('moving.damageChecklist')}: </span>
                  {request.damageChecklist ?? '—'}
                </p>
                <div>
                  <p className="font-medium">{t('moving.photosTitle')}</p>
                  {request.photos.length === 0 ? (
                    <p className="mt-1 text-muted-foreground">{t('moving.emptyPhotos')}</p>
                  ) : (
                    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
        {actionSuccess ? <p className="text-sm text-primary">{actionSuccess}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('driver.jobsTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('driver.jobsSubtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <JobListSection
          headingId="assigned-jobs"
          title={t('driver.assignedTitle')}
          query={assignedQuery}
          emptyLabel={t('driver.emptyAssigned')}
          listErrorLabel={t('driver.assignedListError')}
          retryLabel={t('common.retry')}
          loadingLabel={t('common.loading')}
          renderActions={(item) => (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to={`/driver/jobs/${item.id}`}>{t('driver.updateStatus')}</Link>
              </Button>
              {canDriverCancelAssignedJob(item.status) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    setActionError(null)
                    setActionSuccess(null)
                    setCancelJobTarget(item)
                  }}
                >
                  {t('driver.cancelJob')}
                </Button>
              ) : null}
            </>
          )}
          statusLabel={(status) => t(`moving.statusBadge.${status}`, { defaultValue: status })}
          moveInDateLabel={t('moving.moveInDate')}
          earningsLabel={t('moving.estimatedEarnings')}
        />

        <JobListSection
          headingId="available-jobs"
          title={t('driver.availableTitle')}
          query={availableQuery}
          emptyLabel={t('driver.emptyJobs')}
          listErrorLabel={t('driver.listError')}
          retryLabel={t('common.retry')}
          loadingLabel={t('common.loading')}
          renderActions={(item) => (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to={`/driver/jobs/${item.id}`}>{t('driver.viewJob')}</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate(item.id)}
              >
                {t('driver.accept')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(item.id)}
              >
                {t('driver.reject')}
              </Button>
            </>
          )}
          moveInDateLabel={t('moving.moveInDate')}
          earningsLabel={t('moving.estimatedEarnings')}
        />
      </div>

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
      {actionSuccess ? <p className="text-sm text-primary">{actionSuccess}</p> : null}

      <CancelDriverJobDialog
        open={Boolean(cancelJobTarget)}
        orderLabel={cancelJobTarget?.orderNumber ?? cancelJobTarget?.id ?? ''}
        isPending={cancelMutation.isPending}
        onDismiss={() => {
          if (!cancelMutation.isPending) {
            setCancelJobTarget(null)
          }
        }}
        onConfirm={(reason) => {
          if (!cancelJobTarget) {
            return
          }
          cancelMutation.mutate({ requestId: cancelJobTarget.id, reason })
        }}
      />
    </div>
  )
}

function JobListSection({
  headingId,
  title,
  query,
  emptyLabel,
  listErrorLabel,
  retryLabel,
  loadingLabel,
  renderActions,
  statusLabel,
  moveInDateLabel,
  earningsLabel,
}: {
  headingId: string
  title: string
  query: {
    isLoading: boolean
    isError: boolean
    refetch: () => unknown
    data?: { items: MovingRequest[] }
  }
  emptyLabel: string
  listErrorLabel: string
  retryLabel: string
  loadingLabel: string
  renderActions: (item: MovingRequest) => ReactNode
  statusLabel?: (status: string) => string
  moveInDateLabel: string
  earningsLabel: string
}) {
  const items = query.data?.items ?? []

  return (
    <section className="h-full min-w-0" aria-labelledby={headingId}>
      <Card className="flex h-full flex-col">
        <CardHeader>
          <h2 id={headingId} className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </h2>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          {query.isLoading ? <p className="text-sm text-muted-foreground">{loadingLabel}</p> : null}
          {query.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{listErrorLabel}</p>
              <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                {retryLabel}
              </Button>
            </div>
          ) : null}
          {!query.isLoading && !query.isError && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          ) : null}
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {item.orderNumber ?? item.id}: {item.pickupAddress} → {item.dropoffAddress}
                  </p>
                  <p className="text-muted-foreground">
                    {moveInDateLabel}: {formatMoveInDate(item.moveInDate)}
                  </p>
                  <p className="text-muted-foreground">
                    {earningsLabel}: {item.estimatedEarnings ?? '—'}
                  </p>
                  {statusLabel ? (
                    <p className="text-muted-foreground">{statusLabel(item.status)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">{renderActions(item)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
