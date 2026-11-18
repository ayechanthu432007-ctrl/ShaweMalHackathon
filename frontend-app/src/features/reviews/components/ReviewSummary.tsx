import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { reviewsApi } from '../api/reviews-api'
import { StarRating } from './StarRating'

export function ReviewSummary({
  targetType,
  targetUserId,
  title,
  note,
  className,
}: {
  targetType: 'AGENT' | 'DRIVER'
  targetUserId?: string
  title?: string
  note?: string
  className?: string
}) {
  const { t } = useTranslation()
  const summaryQuery = useQuery({
    queryKey: ['review-summary', targetType, targetUserId ?? 'all'],
    queryFn: () => reviewsApi.summary(targetType, targetUserId),
    staleTime: 5 * 60 * 1000,
  })

  if (summaryQuery.isError) return null

  return (
    <div className={cn('space-y-1', className)} aria-live="polite">
      {title ? <p className="text-xs font-medium text-muted-foreground">{title}</p> : null}
      {summaryQuery.isLoading ? (
        <div className="h-5 w-36 animate-pulse rounded bg-muted" aria-label={t('common.loading')} />
      ) : summaryQuery.data ? (
        summaryQuery.data.summary.reviewCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StarRating value={summaryQuery.data.summary.averageRating} readOnly size="sm" />
            <span className="font-semibold tabular-nums">{summaryQuery.data.summary.averageRating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              {t('reviews.summaryCount', { count: summaryQuery.data.summary.reviewCount })}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('reviews.noRatings')}</p>
        )
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}
