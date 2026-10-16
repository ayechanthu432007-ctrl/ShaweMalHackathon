import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export type PostQuota = { used: number; limit: number; remaining: number; resetsAt: string }

/** How many of this month's Marketplace posts are used, with a small bar. */
export function PostQuotaMeter({ quota, className }: { quota: PostQuota; className?: string }) {
  const { t, i18n } = useTranslation()
  const full = quota.remaining <= 0
  const percent = Math.min(100, Math.round((quota.used / quota.limit) * 100))
  const resets = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(new Date(quota.resetsAt))

  return (
    <div className={cn('rounded-xl border bg-card p-4', full && 'border-amber-500/50 bg-amber-500/5', className)} role="status">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-semibold">{t('marketplace.quota.used', { used: quota.used, limit: quota.limit })}</p>
        <p className={cn('text-muted-foreground', full && 'font-medium text-amber-700 dark:text-amber-300')}>
          {full ? t('marketplace.quota.full', { date: resets }) : t('marketplace.quota.remaining', { count: quota.remaining })}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn('h-full rounded-full transition-all', full ? 'bg-amber-500' : 'bg-button')} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
