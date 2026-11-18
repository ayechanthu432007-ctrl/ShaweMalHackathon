import { X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type ActiveFilter = {
  key: string
  label: string
  onRemove: () => void
}

type FilterBarProps = {
  children: ReactNode
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  onClear?: () => void
  activeFilters?: ActiveFilter[]
  title?: string
  description?: string
  submitLabel?: string
  clearLabel?: string
  actions?: ReactNode
  className?: string
}

/**
 * One filter surface for every operational page: responsive field grid, standard apply/clear
 * buttons, and removable chips that show which filters are currently applied.
 */
export function FilterBar({
  children,
  onSubmit,
  onClear,
  activeFilters = [],
  title,
  description,
  submitLabel,
  clearLabel,
  actions,
  className,
}: FilterBarProps) {
  const { t } = useTranslation()

  return (
    <Card className={cn('print:hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title ?? t('ops.filters.title')}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit?.(event)
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('ops.filters.active')}>
              <span className="text-xs font-medium text-muted-foreground">{t('ops.filters.active')}:</span>
              {activeFilters.map((filter) => (
                <span key={filter.key} className="inline-flex items-center gap-1 rounded-full border bg-muted/60 py-0.5 pl-2.5 pr-1 text-xs">
                  {filter.label}
                  <button
                    type="button"
                    onClick={filter.onRemove}
                    className="rounded-full p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('ops.filters.remove', { label: filter.label })}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              {onClear ? (
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onClear}>
                  {t('ops.filters.clearAll')}
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {onSubmit ? <Button type="submit">{submitLabel ?? t('ops.filters.apply')}</Button> : null}
            {onClear ? (
              <Button type="button" variant="outline" onClick={onClear}>
                {clearLabel ?? t('common.clear')}
              </Button>
            ) : null}
            {actions}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
