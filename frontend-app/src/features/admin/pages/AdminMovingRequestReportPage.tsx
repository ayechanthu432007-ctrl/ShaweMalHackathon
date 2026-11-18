import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import {
  DataTable,
  FilterBar,
  StatusBadge,
  type DataTableColumn,
} from '@/components/operational'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { selectClassName } from '@/components/ui/field-styles'
import { ALL_MOVING_STATUSES } from '@/features/moving/lib/moving-status'

import { adminApi } from '../api/admin-api'
import type { MovingRequestReportFilters } from '../types'

type ReportRow = Awaited<ReturnType<typeof adminApi.getMovingRequestReport>>['items'][number]

function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function formatMoney(value?: number | null): string {
  return typeof value === 'number' ? `${value.toLocaleString()} MMK` : '—'
}

export function AdminMovingRequestReportPage() {
  const { t } = useTranslation()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<MovingRequestReportFilters>({})

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'moving', applied],
    queryFn: () => adminApi.getMovingRequestReport(applied),
  })

  const rows = reportQuery.data?.items ?? []

  const clear = () => {
    setFrom('')
    setTo('')
    setStatus('')
    setApplied({})
  }

  const activeFilters = [
    ...(applied.from ? [{ key: 'from', label: `${t('admin.reports.from')}: ${applied.from}`, onRemove: () => { setFrom(''); setApplied((current) => ({ ...current, from: undefined })) } }] : []),
    ...(applied.to ? [{ key: 'to', label: `${t('admin.reports.to')}: ${applied.to}`, onRemove: () => { setTo(''); setApplied((current) => ({ ...current, to: undefined })) } }] : []),
    ...(applied.status ? [{ key: 'status', label: `${t('admin.movingReport.status')}: ${t(`moving.statusBadge.${applied.status}`, { defaultValue: applied.status })}`, onRemove: () => { setStatus(''); setApplied((current) => ({ ...current, status: undefined })) } }] : []),
  ]

  const columns: DataTableColumn<ReportRow>[] = [
    {
      key: 'orderNumber',
      header: t('admin.movingReport.columns.orderNumber'),
      cell: (row) => <span className="font-mono text-xs">{row.orderNumber ?? row.id}</span>,
      sortValue: (row) => row.orderNumber ?? row.id,
    },
    {
      key: 'createdAt',
      header: t('admin.movingReport.columns.date'),
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => new Date(row.createdAt ?? 0),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: t('admin.movingReport.columns.status'),
      cell: (row) => (
        <StatusBadge
          status={row.status}
          label={t(`moving.statusBadge.${row.status}`, { defaultValue: row.status })}
        />
      ),
      sortValue: (row) => row.status,
    },
    {
      key: 'route',
      header: t('admin.movingReport.columns.route'),
      cell: (row) => (
        <div>
          <div>{row.pickupAddress}</div>
          <div className="text-xs text-muted-foreground">{row.dropoffAddress}</div>
        </div>
      ),
      sortValue: (row) => row.pickupAddress,
    },
    {
      key: 'moveInDate',
      header: t('admin.movingReport.columns.moveInDate'),
      cell: (row) => formatDateTime(row.moveInDate),
      sortValue: (row) => new Date(row.moveInDate ?? 0),
      hideOnMobile: true,
    },
    {
      key: 'requester',
      header: t('admin.movingReport.columns.requester'),
      cell: (row) => (
        <div>
          <div>{row.requester?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{row.requester?.email}</div>
        </div>
      ),
      sortValue: (row) => row.requester?.name ?? '',
    },
    {
      key: 'driver',
      header: t('admin.movingReport.columns.driver'),
      cell: (row) => row.assignedDriver?.driverProfile?.name ?? row.assignedDriver?.name ?? '—',
      sortValue: (row) => row.assignedDriver?.driverProfile?.name ?? row.assignedDriver?.name ?? '',
      hideOnMobile: true,
    },
    {
      key: 'price',
      header: t('admin.movingReport.columns.price'),
      cell: (row) => formatMoney(row.estimatedPrice),
      sortValue: (row) => row.estimatedPrice ?? 0,
      align: 'right',
    },
    {
      key: 'actions',
      header: t('admin.movingReport.columns.actions'),
      align: 'right',
      cell: (row) => (
        <Button asChild size="sm" variant="outline">
          <Link to={`/admin/reports/moving/${row.id}`}>{t('admin.movingReport.viewDetails')}</Link>
        </Button>
      ),
      mobileFullWidth: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.movingReport.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.movingReport.subtitle')}</p>
      </div>

      <FilterBar
        description={t('admin.movingReport.filtersDescription')}
        onSubmit={() => setApplied({ from: from || undefined, to: to || undefined, status: status || undefined })}
        onClear={clear}
        activeFilters={activeFilters}
      >
        <div className="space-y-2">
          <Label htmlFor="moving-from">{t('admin.reports.from')}</Label>
          <Input id="moving-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moving-to">{t('admin.reports.to')}</Label>
          <Input id="moving-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moving-status">{t('admin.movingReport.status')}</Label>
          <select id="moving-status" className={selectClassName} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t('admin.movingReport.anyStatus')}</option>
            {ALL_MOVING_STATUSES.map((code) => (
              <option key={code} value={code}>
                {t(`moving.statusBadge.${code}`, { defaultValue: code })}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      {reportQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-danger-soft p-4">
          <p className="text-sm text-destructive">{t('admin.movingReport.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void reportQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption={t('admin.movingReport.title')}
        isLoading={reportQuery.isLoading}
        emptyMessage={t('admin.reports.emptySection')}
        selectable
        rowLabel={(row) => row.orderNumber ?? row.id}
        csv={{
          fileName: 'admin-moving-requests',
          columns: [
            { header: t('admin.movingReport.columns.orderNumber'), value: (row) => row.orderNumber ?? row.id },
            { header: t('admin.movingReport.columns.date'), value: (row) => formatDateTime(row.createdAt) },
            { header: t('admin.movingReport.columns.status'), value: (row) => row.status },
            { header: t('admin.movingReport.columns.route'), value: (row) => `${row.pickupAddress} -> ${row.dropoffAddress}` },
            { header: t('admin.movingReport.columns.moveInDate'), value: (row) => formatDateTime(row.moveInDate) },
            { header: t('admin.movingReport.columns.requester'), value: (row) => row.requester?.name ?? '' },
            { header: t('auth.email'), value: (row) => row.requester?.email ?? '' },
            { header: t('admin.movingReport.columns.driver'), value: (row) => row.assignedDriver?.driverProfile?.name ?? row.assignedDriver?.name ?? '' },
            { header: t('admin.movingReport.columns.price'), value: (row) => formatMoney(row.estimatedPrice) },
          ],
        }}
        toolbar={
          reportQuery.data ? (
            <span className="text-sm text-muted-foreground">
              {t('admin.movingReport.records', { count: reportQuery.data.items.length })}
            </span>
          ) : null
        }
      />
    </section>
  )
}
