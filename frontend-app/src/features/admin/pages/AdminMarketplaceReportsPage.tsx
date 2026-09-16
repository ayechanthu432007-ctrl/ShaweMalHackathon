import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { adminMarketplaceApi, type ReportStatus } from '../api/admin-marketplace-api'
import { AdminMarketplaceNav, Pager } from '../components/AdminMarketplaceNav'
import { AdminReportCard } from '../components/AdminReportCard'

const TABS: Array<ReportStatus | 'ALL'> = ['OPEN', 'RESOLVED', 'DISMISSED', 'ALL']

export function AdminMarketplaceReportsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const status = (TABS.includes(statusParam as ReportStatus) ? statusParam : 'OPEN') as ReportStatus | 'ALL'
  const page = Number(searchParams.get('page') ?? '1') || 1

  const reportsQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'reports', status, page],
    queryFn: () => adminMarketplaceApi.listReports({ status: status === 'ALL' ? undefined : status, page }),
  })

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('admin.marketplace.reports.title')}</h1>
      <AdminMarketplaceNav />

      <div className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium',
              status === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setSearchParams({ status: value })}
          >
            {value === 'ALL' ? t('marketplace.my.all') : t(`admin.marketplace.reports.status.${value}`)}
          </button>
        ))}
      </div>

      {reportsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {reportsQuery.isError ? <p className="text-sm text-destructive">{t('admin.marketplace.loadError')}</p> : null}
      {reportsQuery.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.marketplace.reports.empty')}</p> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {reportsQuery.data?.items.map((report) => (
          <AdminReportCard key={report.id} report={report} />
        ))}
      </div>

      {reportsQuery.data ? (
        <Pager
          page={reportsQuery.data.page}
          totalPages={reportsQuery.data.totalPages}
          onPage={(next) => setSearchParams({ status, page: String(next) })}
        />
      ) : null}
    </section>
  )
}
