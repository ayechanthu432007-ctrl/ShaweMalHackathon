import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { adminApi } from '../api/admin-api'
import { ReportSummaryCards } from '../components/ReportSummaryCards'

export function AdminDashboardPage() {
  const { t } = useTranslation()

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview', 'dashboard'],
    queryFn: () => adminApi.getReportsOverview(),
  })

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('admin.dashboardTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('admin.dashboardSubtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/reports">{t('admin.nav.reports')}</Link>
        </Button>
      </div>

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
        <>
          <ReportSummaryCards report={reportQuery.data} />
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.dashboard.quickLinks')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to="/admin/reports/bookings">{t('admin.nav.bookingReport')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/admin/reports/moving">{t('admin.nav.movingReport')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/admin/users">{t('admin.nav.users')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/admin/jobs-assign">{t('admin.nav.jobsAssign')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/admin/master-data">{t('admin.nav.masterData')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/admin/marketplace">{t('admin.nav.marketplace')}</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  )
}
