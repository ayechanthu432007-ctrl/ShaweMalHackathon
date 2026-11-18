import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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

import { adminApi } from '../api/admin-api'
import type { HouseBookingReportFilters } from '../types'

type ReportRow = Awaited<ReturnType<typeof adminApi.getHouseBookingReport>>['items'][number]

function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

export function AdminHouseBookingReportPage() {
  const { t } = useTranslation()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<HouseBookingReportFilters>({})

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'bookings', applied],
    queryFn: () => adminApi.getHouseBookingReport(applied),
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
    ...(applied.status ? [{ key: 'status', label: `${t('admin.bookingReport.status')}: ${applied.status}`, onRemove: () => { setStatus(''); setApplied((current) => ({ ...current, status: undefined })) } }] : []),
  ]

  const columns: DataTableColumn<ReportRow>[] = [
    {
      key: 'id',
      header: t('admin.bookingReport.columns.id'),
      cell: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>,
      sortValue: (row) => row.id,
      hideOnMobile: true,
    },
    {
      key: 'createdAt',
      header: t('admin.bookingReport.columns.date'),
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => new Date(row.createdAt),
    },
    {
      key: 'status',
      header: t('admin.bookingReport.columns.status'),
      cell: (row) => <StatusBadge status={row.status} label={t(`admin.bookingReport.statusValue.${row.status}`, { defaultValue: row.status })} />,
      sortValue: (row) => row.status,
    },
    {
      key: 'house',
      header: t('admin.bookingReport.columns.house'),
      cell: (row) => row.house?.title ?? row.houseId,
      sortValue: (row) => row.house?.title ?? row.houseId,
    },
    {
      key: 'agent',
      header: t('admin.bookingReport.columns.agent'),
      cell: (row) => row.house?.agent?.name ?? row.house?.agentId ?? '—',
      sortValue: (row) => row.house?.agent?.name ?? row.house?.agentId ?? '',
      hideOnMobile: true,
    },
    {
      key: 'booker',
      header: t('admin.bookingReport.columns.booker'),
      cell: (row) => (
        <div>
          <div>{row.user?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{row.user?.email}</div>
        </div>
      ),
      sortValue: (row) => row.user?.name ?? '',
    },
    {
      key: 'cancelledBy',
      header: t('admin.bookingReport.columns.cancelledBy'),
      cell: (row) => row.cancelledByRole ?? '—',
      sortValue: (row) => row.cancelledByRole ?? '',
      hideOnMobile: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.bookingReport.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.bookingReport.subtitle')}</p>
      </div>

      <FilterBar
        description={t('admin.bookingReport.filtersDescription')}
        onSubmit={() => setApplied({ from: from || undefined, to: to || undefined, status: status || undefined })}
        onClear={clear}
        activeFilters={activeFilters}
      >
        <div className="space-y-2">
          <Label htmlFor="booking-from">{t('admin.reports.from')}</Label>
          <Input id="booking-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-to">{t('admin.reports.to')}</Label>
          <Input id="booking-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-status">{t('admin.bookingReport.status')}</Label>
          <select id="booking-status" className={selectClassName} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t('admin.bookingReport.anyStatus')}</option>
            {(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'] as const).map((code) => (
              <option key={code} value={code}>
                {t(`admin.bookingReport.statusValue.${code}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      {reportQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-danger-soft p-4">
          <p className="text-sm text-destructive">{t('admin.bookingReport.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void reportQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption={t('admin.bookingReport.title')}
        isLoading={reportQuery.isLoading}
        emptyMessage={t('admin.reports.emptySection')}
        selectable
        rowLabel={(row) => row.house?.title ?? row.id}
        csv={{
          fileName: 'admin-house-bookings',
          columns: [
            { header: t('admin.bookingReport.columns.id'), value: (row) => row.id },
            { header: t('admin.bookingReport.columns.date'), value: (row) => formatDateTime(row.createdAt) },
            { header: t('admin.bookingReport.columns.status'), value: (row) => row.status },
            { header: t('admin.bookingReport.columns.house'), value: (row) => row.house?.title ?? row.houseId },
            { header: t('admin.bookingReport.columns.agent'), value: (row) => row.house?.agent?.name ?? row.house?.agentId ?? '' },
            { header: t('admin.bookingReport.columns.booker'), value: (row) => row.user?.name ?? '' },
            { header: t('auth.email'), value: (row) => row.user?.email ?? '' },
            { header: t('admin.bookingReport.columns.cancelledBy'), value: (row) => row.cancelledByRole ?? '' },
          ],
        }}
        toolbar={
          reportQuery.data ? (
            <span className="text-sm text-muted-foreground">
              {t('admin.bookingReport.records', { count: reportQuery.data.items.length })}
            </span>
          ) : null
        }
      />
    </section>
  )
}
