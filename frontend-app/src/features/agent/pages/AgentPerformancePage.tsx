import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { agentPlanApi, type Totals } from '../api/agent-plan-api'
import { BarSeries, PageHeading, QueryState, StatTile } from '../components/dashboard-parts'

const METRICS = ['views', 'inquiries', 'calls'] as const
type Metric = (typeof METRICS)[number]
const RANGES = [7, 30, 90] as const

export function AgentPerformancePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const metric: Metric = METRICS.find((value) => value === params.get('metric')) ?? 'views'
  const requestedDays = RANGES.find((value) => String(value) === params.get('days')) ?? 30

  const query = useQuery({
    queryKey: ['agent', 'performance', requestedDays],
    queryFn: async () => (await agentPlanApi.performance(requestedDays)).performance,
  })
  const performance = query.data

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  if (!performance) {
    return (
      <div className="space-y-4">
        <PageHeading title={t('agentDash.nav.performance')} />
        <QueryState isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const totals: Totals = performance.totals
  const metricLabel = t(`agentDash.metric.${metric}`)
  const tickEvery = performance.rangeDays > 30 ? 14 : performance.rangeDays > 7 ? 5 : 1

  return (
    <div className="space-y-6">
      <PageHeading title={t('agentDash.nav.performance')} subtitle={t('agentDash.lastNDays', { count: performance.rangeDays })} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('agentDash.metric.views')} value={totals.views} />
        <StatTile label={t('agentDash.metric.inquiries')} value={totals.inquiries} hint={t('agentDash.inquiriesHint', { bookings: totals.bookings })} />
        <StatTile label={t('agentDash.metric.calls')} value={totals.calls} />
        <StatTile label={t('agentDash.metric.messages')} value={totals.telegram + totals.viber} hint="Telegram + Viber" />
      </div>
      <p className="text-xs text-muted-foreground">{t('agentDash.metricDefinitions')}</p>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">{t('agentDash.dailyTitle', { metric: metricLabel })}</CardTitle>
          {/* Filters sit in one row above the chart. */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t('agentDash.metricLabel')}>
              {METRICS.map((value) => (
                <Button key={value} type="button" size="sm" variant={metric === value ? 'default' : 'ghost'} aria-pressed={metric === value} onClick={() => setParam('metric', value)}>
                  {t(`agentDash.metric.${value}`)}
                </Button>
              ))}
            </div>
            {performance.level === 'DETAILED' ? (
              <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t('agentDash.rangeLabel')}>
                {RANGES.map((value) => (
                  <Button key={value} type="button" size="sm" variant={performance.rangeDays === value ? 'default' : 'ghost'} aria-pressed={performance.rangeDays === value} onClick={() => setParam('days', String(value))}>
                    {t('agentDash.daysShort', { count: value })}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {performance.series ? (
            <BarSeries
              unit={metricLabel.toLowerCase()}
              ariaLabel={t('agentDash.dailyTitle', { metric: metricLabel })}
              tickEvery={tickEvery}
              data={performance.series.map((row) => ({ label: row.day.slice(5), title: row.day, value: row[metric] }))}
            />
          ) : (
            <div className="space-y-2 rounded-lg border border-dashed p-6 text-sm">
              <p>{t('agentDash.chartLocked')}</p>
              <Button asChild size="sm">
                <Link to="/agent/subscription">{t('agentDash.viewPlans')}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('agentDash.byListing')}</CardTitle>
        </CardHeader>
        <CardContent>
          {performance.listings ? (
            performance.listings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agentDash.noListings')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">{t('agentDash.listing')}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.metric.views')}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{t('agentDash.metric.inquiries')}</th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">{t('agentDash.metric.calls')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.listings.map((row) => (
                      <tr key={row.house.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={`/houses/${row.house.id}`} className="hover:underline">
                            {row.house.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.views}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.inquiries}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{row.calls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{t('agentDash.byListingLocked')}</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/agent/subscription">{t('agentDash.viewPlans')}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
