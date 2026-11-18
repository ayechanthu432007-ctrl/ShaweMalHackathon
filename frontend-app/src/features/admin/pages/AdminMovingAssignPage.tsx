import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTable,
  FilterBar,
  StatusBadge,
  type DataTableColumn,
} from '@/components/operational'
import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
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
    if (appliedOrderNumber) return t('admin.jobsAssign.emptySearch')
    return t('admin.jobsAssign.empty')
  }, [appliedOrderNumber, t])

  const columns: DataTableColumn<MovingRequest>[] = [
    {
      key: 'orderNumber',
      header: t('moving.orderNumber'),
      cell: (job) => <span className="font-mono text-xs">{job.orderNumber ?? job.id}</span>,
      sortValue: (job) => job.orderNumber ?? job.id,
    },
    {
      key: 'route',
      header: t('admin.jobsAssign.route'),
      cell: (job) => (
        <div className="min-w-0">
          <div className="truncate">{job.pickupAddress}</div>
          <div className="truncate text-xs text-muted-foreground">→ {job.dropoffAddress}</div>
          {latestCancelNotes(job) ? (
            <div className="mt-1 text-xs text-warning">{t('admin.jobsAssign.cancelReason')}: {latestCancelNotes(job)}</div>
          ) : null}
        </div>
      ),
      sortValue: (job) => job.pickupAddress,
      cellClassName: 'max-w-[18rem]',
    },
    {
      key: 'moveInDate',
      header: t('moving.moveInDate'),
      cell: (job) => formatDateTime(job.moveInDate),
      sortValue: (job) => new Date(job.moveInDate ?? 0),
      hideOnMobile: true,
    },
    {
      key: 'requester',
      header: t('admin.jobsAssign.requester'),
      cell: (job) => (
        <div>
          <div>{job.requester?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{job.requester?.phone ?? '—'}</div>
        </div>
      ),
      sortValue: (job) => job.requester?.name ?? '',
    },
    {
      key: 'price',
      header: t('moving.estimatedPrice'),
      cell: (job) => (typeof job.estimatedPrice === 'number' ? `${job.estimatedPrice.toLocaleString()} MMK` : '—'),
      sortValue: (job) => job.estimatedPrice ?? 0,
      align: 'right',
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: t('admin.jobsAssign.status'),
      cell: (job) => (
        <StatusBadge
          status={job.status}
          label={t(`moving.statusBadge.${job.status}`, { defaultValue: job.status })}
        />
      ),
      sortValue: (job) => job.status,
    },
    {
      key: 'assign',
      header: t('admin.jobsAssign.chooseDriver'),
      cell: (job) => {
        const selectedDriverId = selectedDrivers[job.id] ?? ''
        if (drivers.length === 0) {
          return <p className="text-sm text-muted-foreground">{t('admin.jobsAssign.noDrivers')}</p>
        }
        return (
          <form
            className="flex flex-wrap items-end gap-2"
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
            <select
              aria-label={t('admin.jobsAssign.chooseDriver')}
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
            <Button type="submit" size="sm" disabled={assigningId === job.id}>
              {assigningId === job.id ? t('common.loading') : t('admin.jobsAssign.submit')}
            </Button>
          </form>
        )
      },
      mobileFullWidth: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.jobsAssign.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.jobsAssign.subtitle')}</p>
      </div>

      <FilterBar
        description={t('admin.jobsAssign.searchDescription')}
        onSubmit={() => {
          setFormError(null)
          setSuccessMessage(null)
          setAppliedOrderNumber(orderNumber.trim())
        }}
        onClear={() => {
          setOrderNumber('')
          setAppliedOrderNumber('')
          setFormError(null)
          setSuccessMessage(null)
        }}
        activeFilters={
          appliedOrderNumber
            ? [{ key: 'order', label: appliedOrderNumber, onRemove: () => { setOrderNumber(''); setAppliedOrderNumber('') } }]
            : []
        }
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="jobs-assign-order">{t('moving.orderNumber')}</Label>
          <Input
            id="jobs-assign-order"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder={t('admin.jobsAssign.orderPlaceholder')}
          />
        </div>
      </FilterBar>

      {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}
      {successMessage ? <p className="text-sm text-success-ink" role="status">{successMessage}</p> : null}

      {jobsQuery.isError || driversQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-danger-soft p-4">
          <p className="text-sm text-destructive">{t('admin.jobsAssign.loadError')}</p>
          <Button
            type="button"
            onClick={() => {
              void jobsQuery.refetch()
              void driversQuery.refetch()
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      <DataTable
        rows={jobs}
        columns={columns}
        rowKey={(job) => job.id}
        caption={t('admin.jobsAssign.title')}
        isLoading={jobsQuery.isLoading || driversQuery.isLoading}
        emptyMessage={emptyLabel}
        selectable
        rowLabel={(job) => job.orderNumber ?? job.id}
        csv={{
          fileName: 'admin-assignable-moving-requests',
          columns: [
            { header: t('moving.orderNumber'), value: (job) => job.orderNumber ?? job.id },
            { header: t('admin.jobsAssign.route'), value: (job) => `${job.pickupAddress} -> ${job.dropoffAddress}` },
            { header: t('moving.moveInDate'), value: (job) => formatDateTime(job.moveInDate) },
            { header: t('admin.jobsAssign.requester'), value: (job) => job.requester?.name ?? '' },
            { header: t('auth.phone'), value: (job) => job.requester?.phone ?? '' },
            { header: t('moving.estimatedPrice'), value: (job) => job.estimatedPrice ?? '' },
            { header: t('admin.jobsAssign.status'), value: (job) => job.status },
            { header: t('admin.jobsAssign.cancelReason'), value: (job) => latestCancelNotes(job) ?? '' },
          ],
        }}
        toolbar={
          jobsQuery.data ? (
            <span className="text-sm text-muted-foreground">
              {t('admin.jobsAssign.records', { count: jobsQuery.data.items.length })}
            </span>
          ) : null
        }
      />
    </section>
  )
}
