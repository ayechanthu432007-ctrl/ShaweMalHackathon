import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CarouselControlsProps = {
  /** Current position, 0-based. */
  index: number
  /** Number of positions (pages or scroll stops). Nothing renders when there is only one. */
  count: number
  onChange: (index: number) => void
  className?: string
}

/**
 * Previous / position dots / Next for every card carousel on the site (Popular Houses,
 * Featured Houses). Each carousel keeps its own data and paging; this only draws the controls,
 * so they always share one size, icon set, disabled state and dot indicator.
 */
export function CarouselControls({ index, count, onChange, className }: CarouselControlsProps) {
  const { t } = useTranslation()
  if (count <= 1) return null
  const last = count - 1

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full px-4 shadow-card"
        disabled={index <= 0}
        onClick={() => onChange(index - 1)}
      >
        <ChevronLeft aria-hidden />
        <span>{t('common.previous')}</span>
      </Button>
      <ol className="flex flex-wrap items-center justify-center gap-0.5" aria-label={t('home.carouselPosition')}>
        {Array.from({ length: count }, (_, position) => (
          <li key={position}>
            <button
              type="button"
              aria-label={t('home.carouselGoTo', { position: position + 1 })}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => onChange(position)}
              className="group flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all duration-200 motion-reduce:transition-none',
                  position === index ? 'w-5 bg-brand-sky-strong' : 'w-2 bg-muted-foreground/35 group-hover:bg-muted-foreground/60',
                )}
              />
            </button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full px-4 shadow-card"
        disabled={index >= last}
        onClick={() => onChange(index + 1)}
      >
        <span>{t('common.next')}</span>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )
}
