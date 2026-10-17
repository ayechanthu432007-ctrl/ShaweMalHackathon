import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { textareaClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/features/marketplace/lib/marketplace-format'
import { ApiRequestError } from '@/lib/api/client'

import { adminMarketplaceApi, type AdminReport } from '../api/admin-marketplace-api'
import { StatusPill } from './AdminMarketplaceNav'

const REPORT_STATUS_TONE = {
  OPEN: 'bg-warning-soft text-warning',
  RESOLVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DISMISSED: 'bg-muted text-muted-foreground',
} as const

export function AdminReportCard({ report }: { report: AdminReport }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [removeListing, setRemoveListing] = useState(false)

  const resolveMutation = useMutation({
    mutationFn: (status: 'RESOLVED' | 'DISMISSED') =>
      adminMarketplaceApi.resolveReport(report.id, {
        status,
        adminNote: note.trim() || undefined,
        removeListing: status === 'RESOLVED' && removeListing,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace'] }),
  })

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-semibold">{t(`marketplace.report.reasons.${report.reason}`)}</p>
          <p className="text-xs text-muted-foreground">
            {t('admin.marketplace.reports.reportedBy', { name: report.reporter.name, date: formatDate(report.createdAt) })}
          </p>
        </div>
        <StatusPill tone={REPORT_STATUS_TONE[report.status]}>{t(`admin.marketplace.reports.status.${report.status}`)}</StatusPill>
      </div>

      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        {report.listing ? (
          <div>
            <dt className="text-xs text-muted-foreground">{t('admin.marketplace.reports.listing')}</dt>
            <dd>
              <Link to={`/admin/marketplace/listings/${report.listing.id}`} className="text-primary hover:underline">
                {report.listing.title}
              </Link>{' '}
              <span className="text-xs text-muted-foreground">({t(`marketplace.moderation.${report.listing.moderationStatus}`)})</span>
            </dd>
          </div>
        ) : null}
        {report.reportedUser ? (
          <div>
            <dt className="text-xs text-muted-foreground">{t('admin.marketplace.reports.seller')}</dt>
            <dd>
              <Link to={`/admin/marketplace/users/${report.reportedUser.id}`} className="text-primary hover:underline">
                {report.reportedUser.name}
              </Link>{' '}
              <span className="text-xs text-muted-foreground">({t(`admin.marketplace.accountStatus.${report.reportedUser.accountStatus}`)})</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {report.description ? <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">{report.description}</p> : null}

      {report.status === 'OPEN' ? (
        <div className="space-y-2 border-t pt-3">
          <textarea
            className={textareaClassName}
            aria-label={t('admin.marketplace.reports.note')}
            placeholder={t('admin.marketplace.reports.note')}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {report.listing && report.listing.moderationStatus !== 'REMOVED' ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={removeListing} onChange={(event) => setRemoveListing(event.target.checked)} />
              {t('admin.marketplace.reports.removeListing')}
            </label>
          ) : null}
          {resolveMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {resolveMutation.error instanceof ApiRequestError ? resolveMutation.error.message : t('admin.marketplace.actionError')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate('RESOLVED')}>
              {t('admin.marketplace.reports.resolve')}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate('DISMISSED')}>
              {t('admin.marketplace.reports.dismiss')}
            </Button>
          </div>
        </div>
      ) : report.adminNote || report.admin ? (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {t('admin.marketplace.reports.closedBy', { name: report.admin?.name ?? '—', date: formatDate(report.resolvedAt) })}
          {report.adminNote ? ` — ${report.adminNote}` : ''}
        </p>
      ) : null}
    </article>
  )
}
