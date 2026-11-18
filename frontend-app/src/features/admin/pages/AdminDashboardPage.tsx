import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, FileWarning, House } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { adminApi } from '../api/admin-api'
import { adminMarketplaceApi } from '../api/admin-marketplace-api'
import { ReportSummaryCards } from '../components/ReportSummaryCards'

export function AdminDashboardPage() {
  const { t } = useTranslation()

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview', 'dashboard'],
    queryFn: () => adminApi.getReportsOverview(),
  })
  const marketplaceQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'overview'],
    queryFn: () => adminMarketplaceApi.overview(),
  })

  const bookingCount = reportQuery.data?.bookingStatusSummary.reduce((sum, row) => sum + row.count, 0)
  const pendingBookingCount = reportQuery.data
    ? reportQuery.data.bookingStatusSummary.find((row) => row.status === 'PENDING')?.count ?? 0
    : null

  const actionCards = [
    {
      key: 'reviews',
      icon: ClipboardCheck,
      count: marketplaceQuery.data?.pendingReviews,
      title: t('admin.dashboard.pendingReviews'),
      detail: t('admin.dashboard.pendingReviewsHint'),
      action: t('admin.dashboard.reviewListings'),
      to: '/admin/marketplace/listings?moderationStatus=PENDING',
    },
    {
      key: 'bookings',
      icon: House,
      count: bookingCount,
      title: t('admin.dashboard.bookings'),
      detail: t('admin.dashboard.bookingsHint', { pending: pendingBookingCount ?? '—' }),
      action: t('admin.dashboard.openBookings'),
      to: '/admin/reports/bookings',
    },
    {
      key: 'reports',
      icon: FileWarning,
      count: marketplaceQuery.data?.openReports,
      title: t('admin.dashboard.openReports'),
      detail: t('admin.dashboard.openReportsHint'),
      action: t('admin.dashboard.reviewReports'),
      to: '/admin/marketplace/reports',
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.dashboardTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('admin.dashboardSubtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/reports">{t('admin.nav.reports')}</Link>
        </Button>
      </div>

      <section className="space-y-3" aria-labelledby="admin-action-summary-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="admin-action-summary-title" className="text-lg font-semibold">{t('admin.dashboard.needsAttention')}</h2>
          {marketplaceQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t('admin.marketplace.loadError')}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void marketplaceQuery.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {actionCards.map((card) => (
            <Card key={card.key} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <card.icon className="size-4 text-primary" aria-hidden />
                  {card.title}
                </CardTitle>
                <span className="text-3xl font-semibold tabular-nums tracking-tight">
                  {card.count ?? (marketplaceQuery.isLoading || reportQuery.isLoading ? '…' : '—')}
                </span>
              </CardHeader>
              <CardContent className="mt-auto flex items-end justify-between gap-3">
                <p className="text-xs text-muted-foreground">{card.detail}</p>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={card.to}>{card.action}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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
