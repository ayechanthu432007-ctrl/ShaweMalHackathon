import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The one loading indicator for pages and sections: a small spinner and "Loading…". */
export function LoadingState({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <p role="status" className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
      {label ?? t('common.loading')}
    </p>
  )
}

/** A page-shaped placeholder for route chunks and full-page queries. */
export function PageSkeleton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const bar = 'animate-pulse rounded bg-muted motion-reduce:animate-none'
  return (
    <div role="status" aria-label={t('common.loading')} className={cn('w-full space-y-6', className)}>
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden className="space-y-3">
        <div className={cn(bar, 'h-8 w-2/3 max-w-sm')} />
        <div className={cn(bar, 'h-4 w-full max-w-xl')} />
      </div>
      <div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl border bg-card p-4">
            <div className={cn(bar, 'h-32 w-full')} />
            <div className={cn(bar, 'h-5 w-4/5')} />
            <div className={cn(bar, 'h-4 w-3/5')} />
            <div className={cn(bar, 'h-9 w-1/3')} />
          </div>
        ))}
      </div>
      <div aria-hidden className="space-y-3 rounded-xl border bg-card p-4">
        <div className={cn(bar, 'h-5 w-1/3')} />
        <div className={cn(bar, 'h-4 w-full')} />
        <div className={cn(bar, 'h-4 w-4/5')} />
      </div>
    </div>
  )
}

/** A detail-page placeholder that reserves room for a gallery and information panel. */
export function DetailPageSkeleton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const bar = 'animate-pulse rounded bg-muted motion-reduce:animate-none'
  return (
    <div role="status" aria-label={t('common.loading')} className={cn('space-y-5', className)}>
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden className={cn(bar, 'h-4 w-28')} />
      <div aria-hidden className={cn(bar, 'h-8 w-3/4 max-w-lg')} />
      <div aria-hidden className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <div className={cn(bar, 'aspect-[4/3] w-full rounded-2xl')} />
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className={cn(bar, 'h-7 w-2/3')} />
          <div className={cn(bar, 'h-5 w-1/2')} />
          <div className="space-y-2 pt-3">
            <div className={cn(bar, 'h-4 w-full')} />
            <div className={cn(bar, 'h-4 w-5/6')} />
            <div className={cn(bar, 'h-4 w-4/5')} />
          </div>
          <div className={cn(bar, 'h-11 w-full')} />
        </div>
      </div>
    </div>
  )
}

/** A failed load: the message and, when the data can be fetched again, a Retry button. */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={cn('space-y-3 rounded-xl border border-destructive/30 bg-danger-soft p-4', className)}>
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}

/** Nothing to show yet: a dashed box with a short explanation and an optional next step. */
export function EmptyState({ text, action, className }: { text: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-dashed p-6 text-sm text-muted-foreground', action && 'space-y-3', className)}>
      <p>{text}</p>
      {action}
    </div>
  )
}

/**
 * Placeholder cards with the same structure and height as the real house / product cards (photo,
 * two-line title, place, facts row, price), so the page keeps its shape while listings load and
 * nothing below them jumps. `withControls` also reserves the carousel's Previous/Next row.
 * Announced to screen readers as "Loading…".
 */
export function CardGridSkeleton({ count = 3, className, withControls = false }: { count?: number; className?: string; withControls?: boolean }) {
  const { t } = useTranslation()
  const bar = 'animate-pulse rounded bg-muted motion-reduce:animate-none'
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden className={className ?? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="aspect-[4/3] animate-pulse bg-muted motion-reduce:animate-none" />
            <div className="flex flex-1 flex-col p-4">
              <div className={cn(bar, 'h-5 w-11/12')} />
              <div className={cn(bar, 'mt-2 h-5 w-3/5')} />
              <div className={cn(bar, 'mt-2 h-4 w-2/5')} />
              <div className="mt-3 border-y py-2.5">
                <div className={cn(bar, 'h-5 w-3/4')} />
              </div>
              <div className={cn(bar, 'mt-4 h-7 w-1/2')} />
            </div>
          </div>
        ))}
      </div>
      {withControls ? <div aria-hidden className="h-10" /> : null}
    </div>
  )
}
