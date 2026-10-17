import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { adminApi } from '../api/admin-api'
import { ReportSummaryCards } from '../components/ReportSummaryCards'

export function AdminReportsPage() {
  const { t } = useTranslation()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({})

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview', applied],
    queryFn: () => adminApi.getReportsOverview(applied),
  })

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.reports.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.reports.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.reports.filtersTitle')}</CardTitle>
          <CardDescription>{t('admin.reports.filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setApplied({
                from: from || undefined,
                to: to || undefined,
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="from">{t('admin.reports.from')}</Label>
              <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">{t('admin.reports.to')}</Label>
              <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <Button type="submit">{t('admin.reports.apply')}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFrom('')
                setTo('')
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
            <CardTitle>{t('admin.reports.loadError')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void reportQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {reportQuery.data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t('admin.reports.periodLabel', {
              from: reportQuery.data.period.from ?? t('admin.reports.periodOpen'),
              to: reportQuery.data.period.to ?? t('admin.reports.periodOpen'),
            })}
          </p>

          <ReportSummaryCards report={reportQuery.data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.reports.housingByCity')}</CardTitle>
              </CardHeader>
              <CardContent>
                {reportQuery.data.housing.byCity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.reports.emptySection')}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reportQuery.data.housing.byCity.map((row) => (
                      <li key={row.cityId} className="flex justify-between gap-4">
                        <span>{row.city}</span>
                        <span className="text-muted-foreground">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.reports.housingByType')}</CardTitle>
              </CardHeader>
              <CardContent>
                {reportQuery.data.housing.byType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.reports.emptySection')}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reportQuery.data.housing.byType.map((row) => (
                      <li key={row.propertyTypeId} className="flex justify-between gap-4">
                        <span>{row.propertyType}</span>
                        <span className="text-muted-foreground">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.reports.topAgents')}</CardTitle>
              </CardHeader>
              <CardContent>
                {reportQuery.data.topPerformers.agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.reports.emptySection')}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reportQuery.data.topPerformers.agents.map((row) => (
                      <li key={row.userId} className="flex justify-between gap-4">
                        <span>{row.name}</span>
                        <span className="text-muted-foreground">
                          {row.averageRating.toFixed(1)} ({row.ratingCount})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.reports.topDrivers')}</CardTitle>
              </CardHeader>
              <CardContent>
                {reportQuery.data.topPerformers.drivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.reports.emptySection')}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reportQuery.data.topPerformers.drivers.map((row) => (
                      <li key={row.userId} className="flex justify-between gap-4">
                        <span>{row.name}</span>
                        <span className="text-muted-foreground">
                          {row.averageRating.toFixed(1)} ({row.ratingCount})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  )
}
