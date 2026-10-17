import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'
import type { MovingRequest } from '@/features/moving/types'

import { adminApi } from '../api/admin-api'
import type { AssignableDriver } from '../types'

function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function driverOptionLabel(driver: AssignableDriver): string {
  const details = [driver.phone, driver.vehicleTypeName, driver.vehicleLicensePlateNumber].filter(Boolean)
  return details.length > 0 ? `${driver.name} · ${details.join(' · ')}` : driver.name
}

function latestCancelNotes(request: MovingRequest): string | null {
  const cancelEvents = [...(request.statusEvents ?? [])]
    .filter((event) => event.status === 'CANCELLED')
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
  return cancelEvents[cancelEvents.length - 1]?.notes ?? null
}

export function AdminMovingAssignPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [orderNumber, setOrderNumber] = useState('')
  const [appliedOrderNumber, setAppliedOrderNumber] = useState('')
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const jobsQuery = useQuery({
    queryKey: ['admin', 'moving', 'assignable-requests', appliedOrderNumber],
    queryFn: () => adminApi.listAssignableMovingRequests(appliedOrderNumber || undefined),
  })

  const driversQuery = useQuery({
    queryKey: ['admin', 'moving', 'assignable-drivers'],
    queryFn: () => adminApi.listAssignableDrivers(),
  })

  const assignMutation = useMutation({
    mutationFn: ({ requestId, driverUserId }: { requestId: string; driverUserId: string }) =>
      adminApi.assignMovingRequest(requestId, driverUserId),
    onSuccess: async (_result, variables) => {
      setFormError(null)
      setSuccessMessage(t('admin.jobsAssign.success'))
      setSelectedDrivers((current) => {
        const next = { ...current }
        delete next[variables.requestId]
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'moving', 'assignable-requests'] })
    },
    onError: (error) => {
      setSuccessMessage(null)
      setFormError(error instanceof ApiRequestError ? error.message : t('admin.jobsAssign.failed'))
    },
  })

  const drivers = driversQuery.data?.items ?? []
  const jobs = jobsQuery.data?.items ?? []
  const assigningId = assignMutation.isPending ? assignMutation.variables?.requestId : null

  const emptyLabel = useMemo(() => {
    if (appliedOrderNumber) {
      return t('admin.jobsAssign.emptySearch')
    }
    return t('admin.jobsAssign.empty')
  }, [appliedOrderNumber, t])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.jobsAssign.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.jobsAssign.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.jobsAssign.searchTitle')}</CardTitle>
          <CardDescription>{t('admin.jobsAssign.searchDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setFormError(null)
              setSuccessMessage(null)
              setAppliedOrderNumber(orderNumber.trim())
            }}
          >
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="jobs-assign-order">{t('moving.orderNumber')}</Label>
              <Input
                id="jobs-assign-order"
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder={t('admin.jobsAssign.orderPlaceholder')}
              />
            </div>
            <Button type="submit">{t('admin.jobsAssign.search')}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOrderNumber('')
                setAppliedOrderNumber('')
                setFormError(null)
                setSuccessMessage(null)
              }}
            >
              {t('common.clear')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {jobsQuery.isLoading || driversQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      ) : null}

      {jobsQuery.isError || driversQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.jobsAssign.loadError')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void jobsQuery.refetch()
                void driversQuery.refetch()
              }}
            >
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {successMessage}
        </p>
      ) : null}

      {jobsQuery.data && driversQuery.data ? (
        jobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">{emptyLabel}</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('admin.jobsAssign.records', { count: jobs.length })}</p>
            {jobs.map((job) => {
              const cancelNotes = latestCancelNotes(job)
              const selectedDriverId = selectedDrivers[job.id] ?? ''

              return (
                <Card key={job.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      <span className="font-mono">{job.orderNumber ?? job.id}</span>
                      <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                        {t(`moving.statusBadge.${job.status}`, { defaultValue: job.status })}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {job.pickupAddress} → {job.dropoffAddress}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <p>
                        <span className="text-muted-foreground">{t('moving.moveInDate')}: </span>
                        {formatDateTime(job.moveInDate)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('admin.jobsAssign.requester')}: </span>
                        {job.requester?.name ?? '—'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('auth.phone')}: </span>
                        {job.requester?.phone ?? '—'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('moving.estimatedPrice')}: </span>
                        {typeof job.estimatedPrice === 'number' ? `${job.estimatedPrice.toLocaleString()} MMK` : '—'}
                      </p>
                    </div>
                    {cancelNotes ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">{t('admin.jobsAssign.cancelReason')}: </span>
                        {cancelNotes}
                      </p>
                    ) : null}
                    {drivers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('admin.jobsAssign.noDrivers')}</p>
                    ) : (
                      <form
                        className="flex flex-wrap items-end gap-3"
                        onSubmit={(event) => {
                          event.preventDefault()
                          if (!selectedDriverId) {
                            setSuccessMessage(null)
                            setFormError(t('admin.jobsAssign.driverRequired'))
                            return
                          }
                          assignMutation.mutate({ requestId: job.id, driverUserId: selectedDriverId })
                        }}
                      >
                        <div className="min-w-[18rem] flex-1 space-y-2">
                          <Label htmlFor={`driver-${job.id}`}>{t('admin.jobsAssign.chooseDriver')}</Label>
                          <select
                            id={`driver-${job.id}`}
                            className={selectClassName}
                            value={selectedDriverId}
                            onChange={(event) =>
                              setSelectedDrivers((current) => ({ ...current, [job.id]: event.target.value }))
                            }
                          >
                            <option value="">{t('admin.jobsAssign.chooseDriverPlaceholder')}</option>
                            {drivers.map((driver) => (
                              <option key={driver.userId} value={driver.userId}>
                                {driverOptionLabel(driver)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button type="submit" disabled={assigningId === job.id}>
                          {assigningId === job.id ? t('common.loading') : t('admin.jobsAssign.submit')}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      ) : null}
    </section>
  )
}
