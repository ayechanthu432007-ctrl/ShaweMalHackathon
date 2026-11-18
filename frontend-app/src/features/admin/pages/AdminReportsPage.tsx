import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  BarSeries,
  DataTable,
  FilterBar,
  downloadCsv,
  printPage,
  todayStamp,
  type DataTableColumn,
} from '@/components/operational'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { adminApi } from '../api/admin-api'
import { ReportSummaryCards } from '../components/ReportSummaryCards'
import type { AdminOverviewReport } from '../types'

type PerformerRow = AdminOverviewReport['topPerformers']['agents'][number]

export function AdminReportsPage() {
  const { t } = useTranslation()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({})

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview', applied],
    queryFn: () => adminApi.getReportsOverview(applied),
  })

  const report = reportQuery.data

  const clear = () => {
    setFrom('')
    setTo('')
    setApplied({})
  }

  const exportReport = () => {
    if (!report) return
    const rows: Array<{ section: string; label: string; value: string | number }> = [
      { section: t('admin.reports.period'), label: t('admin.reports.from'), value: report.period.from ?? t('admin.reports.periodOpen') },
      { section: t('admin.reports.period'), label: t('admin.reports.to'), value: report.period.to ?? t('admin.reports.periodOpen') },
      ...report.userRegistrationsByRole.map((row) => ({ section: t('admin.reports.cards.users'), label: row.role, value: row.count })),
      ...report.housing.byCity.map((row) => ({ section: t('admin.reports.housingByCity'), label: row.city, value: row.count })),
      ...report.housing.byType.map((row) => ({ section: t('admin.reports.housingByType'), label: row.propertyType, value: row.count })),
      { section: t('admin.reports.cards.housing'), label: t('admin.reports.available'), value: report.housing.byAvailability.available },
      { section: t('admin.reports.cards.housing'), label: t('admin.reports.notAvailable'), value: report.housing.byAvailability.notAvailable },
      ...report.bookingStatusSummary.map((row) => ({ section: t('admin.reports.cards.bookings'), label: row.status, value: row.count })),
      ...report.movingRequestSummary.byStatus.map((row) => ({ section: t('admin.reports.cards.moving'), label: row.status, value: row.count })),
      ...report.topPerformers.agents.map((row) => ({ section: t('admin.reports.topAgents'), label: row.name, value: `${row.averageRating.toFixed(1)} (${row.ratingCount})` })),
      ...report.topPerformers.drivers.map((row) => ({ section: t('admin.reports.topDrivers'), label: row.name, value: `${row.averageRating.toFixed(1)} (${row.ratingCount})` })),
    ]
    downloadCsv(`admin-overview-${todayStamp()}`, [
      { header: t('ops.chart.label'), value: (row) => row.section },
      { header: t('admin.reports.metric'), value: (row) => row.label },
      { header: t('ops.chart.value'), value: (row) => row.value },
    ], rows)
  }

  const performerColumns: DataTableColumn<PerformerRow>[] = [
    {
      key: 'name',
      header: t('admin.reports.name'),
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      key: 'rating',
      header: t('admin.reports.averageRating'),
      cell: (row) => row.averageRating.toFixed(1),
      sortValue: (row) => row.averageRating,
      align: 'right',
    },
    {
      key: 'reviews',
      header: t('admin.reports.ratingCount'),
      cell: (row) => row.ratingCount,
      sortValue: (row) => row.ratingCount,
      align: 'right',
      hideOnMobile: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.reports.title')}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={exportReport} disabled={!report}>
            <Download className="size-4" aria-hidden />
            {t('ops.export.csv')}
          </Button>
          <Button type="button" variant="outline" onClick={printPage} disabled={!report}>
            <Printer className="size-4" aria-hidden />
            {t('ops.export.print')}
          </Button>
        </div>
      </div>

      <FilterBar onSubmit={() => setApplied({ from: from || undefined, to: to || undefined })} onClear={clear} activeFilters={[
        ...(applied.from ? [{ key: 'from', label: `${t('admin.reports.from')}: ${applied.from}`, onRemove: () => { setFrom(''); setApplied((current) => ({ ...current, from: undefined })) } }] : []),
        ...(applied.to ? [{ key: 'to', label: `${t('admin.reports.to')}: ${applied.to}`, onRemove: () => { setTo(''); setApplied((current) => ({ ...current, to: undefined })) } }] : []),
      ]}>
        <div className="space-y-2">
          <Label htmlFor="report-from">{t('admin.reports.from')}</Label>
          <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-to">{t('admin.reports.to')}</Label>
          <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </FilterBar>

      {reportQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-danger-soft p-4">
          <p className="text-sm text-destructive">{t('admin.reports.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void reportQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {reportQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted motion-reduce:animate-none" aria-hidden />
          ))}
          <span className="sr-only" role="status">{t('common.loading')}</span>
        </div>
      ) : null}

      {report ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t('admin.reports.periodLabel', {
              from: report.period.from ?? t('admin.reports.periodOpen'),
              to: report.period.to ?? t('admin.reports.periodOpen'),
            })}
          </p>

          <ReportSummaryCards report={report} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.reports.housingByCity')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarSeries
                  data={report.housing.byCity.map((row) => ({ label: row.city, value: row.count }))}
                  unit={t('admin.reports.listingsUnit')}
                  ariaLabel={t('admin.reports.housingByCity')}
                  exportFileName="admin-housing-by-city"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.reports.housingByType')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarSeries
                  data={report.housing.byType.map((row) => ({ label: row.propertyType, value: row.count }))}
                  unit={t('admin.reports.listingsUnit')}
                  ariaLabel={t('admin.reports.housingByType')}
                  exportFileName="admin-housing-by-type"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.reports.bookingsByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarSeries
                  data={report.bookingStatusSummary.map((row) => ({
                    label: t(`admin.bookingReport.statusValue.${row.status}`, { defaultValue: row.status }),
                    value: row.count,
                  }))}
                  unit={t('admin.reports.bookingsUnit')}
                  ariaLabel={t('admin.reports.bookingsByStatus')}
                  exportFileName="admin-bookings-by-status"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.reports.movingByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarSeries
                  data={report.movingRequestSummary.byStatus.map((row) => ({
                    label: t(`moving.statusBadge.${row.status}`, { defaultValue: row.status }),
                    value: row.count,
                  }))}
                  unit={t('admin.reports.movingUnit')}
                  ariaLabel={t('admin.reports.movingByStatus')}
                  exportFileName="admin-moving-by-status"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">{t('admin.reports.topAgents')}</h2>
              <DataTable
                rows={report.topPerformers.agents}
                columns={performerColumns}
                rowKey={(row) => row.userId}
                caption={t('admin.reports.topAgents')}
                emptyMessage={t('admin.reports.emptySection')}
                sortParam="agentSort"
                directionParam="agentDir"
                csv={{
                  fileName: 'admin-top-agents',
                  columns: [
                    { header: t('admin.reports.name'), value: (row) => row.name },
                    { header: t('admin.reports.averageRating'), value: (row) => row.averageRating },
                    { header: t('admin.reports.ratingCount'), value: (row) => row.ratingCount },
                  ],
                }}
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">{t('admin.reports.topDrivers')}</h2>
              <DataTable
                rows={report.topPerformers.drivers}
                columns={performerColumns}
                rowKey={(row) => row.userId}
                caption={t('admin.reports.topDrivers')}
                emptyMessage={t('admin.reports.emptySection')}
                sortParam="driverSort"
                directionParam="driverDir"
                csv={{
                  fileName: 'admin-top-drivers',
                  columns: [
                    { header: t('admin.reports.name'), value: (row) => row.name },
                    { header: t('admin.reports.averageRating'), value: (row) => row.averageRating },
                    { header: t('admin.reports.ratingCount'), value: (row) => row.ratingCount },
                  ],
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
