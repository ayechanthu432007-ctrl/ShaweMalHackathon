import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PaginationProps = {
  /** Current page, 1-based. */
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** "Page 2 of 5" in the page's own wording. */
  status: string
  className?: string
}

/** Previous / "Page x of y" / Next for every paged result list (houses, marketplace search, admin queues). */
export function Pagination({ page, totalPages, onPageChange, status, className }: PaginationProps) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('common.pagination')} className={cn('flex items-center justify-center gap-3', className)}>
      <Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden />
        {t('common.previous')}
      </Button>
      <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {status}
      </span>
      <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t('common.next')}
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  )
}
