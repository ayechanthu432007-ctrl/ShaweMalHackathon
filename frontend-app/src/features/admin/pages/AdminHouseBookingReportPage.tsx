import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { adminApi } from '../api/admin-api'
import type { HouseBookingReportFilters } from '../types'

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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.bookingReport.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.bookingReport.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.filtersTitle')}</CardTitle>
          <CardDescription>{t('admin.bookingReport.filtersDescription')}</CardDescription>
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
              <Label htmlFor="booking-from">{t('admin.reports.from')}</Label>
              <Input id="booking-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-to">{t('admin.reports.to')}</Label>
              <Input id="booking-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-status">{t('admin.bookingReport.status')}</Label>
              <select
                id="booking-status"
                className={selectClassName}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{t('admin.bookingReport.anyStatus')}</option>
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="CANCELLED">CANCELLED</option>
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
            <CardTitle>{t('admin.bookingReport.loadError')}</CardTitle>
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
            <CardTitle>{t('admin.bookingReport.records', { count: reportQuery.data.items.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {reportQuery.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.reports.emptySection')}</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3">{t('admin.bookingReport.columns.id')}</th>
                      <th className="py-2 pr-3">{t('admin.bookingReport.columns.date')}</th>
                      <th className="py-2 pr-3">{t('admin.bookingReport.columns.status')}</th>
                      <th className="py-2 pr-3">{t('admin.bookingReport.columns.house')}</th>
                      <th className="py-2 pr-3">{t('admin.bookingReport.columns.agent')}</th>
                      <th className="py-2 pr-3">{t('admin.bookingReport.columns.booker')}</th>
                      <th className="py-2">{t('admin.bookingReport.columns.cancelledBy')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{item.id}</td>
                        <td className="py-2 pr-3">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="py-2 pr-3">{item.status}</td>
                        <td className="py-2 pr-3">{item.house?.title ?? item.houseId}</td>
                        <td className="py-2 pr-3">{item.house?.agent?.name ?? item.house?.agentId ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {item.user?.name ?? '—'}
                          <div className="text-xs text-muted-foreground">{item.user?.email}</div>
                        </td>
                        <td className="py-2">{item.cancelledByRole ?? '—'}</td>
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
