import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ALL_MOVING_STATUSES } from '@/features/moving/lib/moving-status'

import { adminApi } from '../api/admin-api'
import type { MovingRequestReportFilters } from '../types'

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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.movingReport.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.movingReport.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.filtersTitle')}</CardTitle>
          <CardDescription>{t('admin.movingReport.filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setApplied({
                from: from || undefined,
                to: to || undefined,
                status: status || undefined,
              })
            }}
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
              <select
                id="moving-status"
                className={selectClassName}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{t('admin.movingReport.anyStatus')}</option>
                {ALL_MOVING_STATUSES.map((code) => (
                  <option key={code} value={code}>
                    {t(`moving.statusBadge.${code}`, { defaultValue: code })}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">{t('admin.reports.apply')}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFrom('')
                setTo('')
                setStatus('')
                setApplied({})
              }}
            >
              {t('common.clear')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      ) : null}

      {reportQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.movingReport.loadError')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void reportQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {reportQuery.data ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.movingReport.records', { count: reportQuery.data.items.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {reportQuery.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.reports.emptySection')}</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[64rem] text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.orderNumber')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.date')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.status')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.route')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.moveInDate')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.requester')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.driver')}</th>
                      <th className="py-2 pr-3">{t('admin.movingReport.columns.price')}</th>
                      <th className="py-2">{t('admin.movingReport.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{item.orderNumber ?? item.id}</td>
                        <td className="py-2 pr-3">{formatDateTime(item.createdAt)}</td>
                        <td className="py-2 pr-3">
                          {t(`moving.statusBadge.${item.status}`, { defaultValue: item.status })}
                        </td>
                        <td className="py-2 pr-3">
                          <div>{item.pickupAddress}</div>
                          <div className="text-xs text-muted-foreground">{item.dropoffAddress}</div>
                        </td>
                        <td className="py-2 pr-3">{formatDateTime(item.moveInDate)}</td>
                        <td className="py-2 pr-3">
                          {item.requester?.name ?? '—'}
                          <div className="text-xs text-muted-foreground">{item.requester?.email}</div>
                        </td>
                        <td className="py-2 pr-3">
                          {item.assignedDriver?.driverProfile?.name ?? item.assignedDriver?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-3">{formatMoney(item.estimatedPrice)}</td>
                        <td className="py-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/reports/moving/${item.id}`}>{t('admin.movingReport.viewDetails')}</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
