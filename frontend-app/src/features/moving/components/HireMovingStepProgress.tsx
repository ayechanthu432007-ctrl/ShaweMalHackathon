import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

const STEP_IDS = [1, 2, 3, 4] as const

export function HireMovingStepProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('moving.progressLabel')} className="mx-auto w-full max-w-xl pt-4">
      <ol className="flex items-center">
        {STEP_IDS.map((step, index) => {
          const isComplete = step < current
          const isCurrent = step === current

          return (
            <li
              key={step}
              className={cn('flex items-center', index < STEP_IDS.length - 1 ? 'min-w-0 flex-1' : 'shrink-0')}
            >
              <span
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={t('moving.stepIndicator', { step, total: 4 })}
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all',
                  isCurrent &&
                    'scale-110 bg-highlight text-[#222222] shadow-sm ring-4 ring-highlight/40',
                  isComplete && 'bg-highlight text-[#222222]',
                  !isCurrent && !isComplete && 'border-2 border-border bg-background text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step}
              </span>
              {index < STEP_IDS.length - 1 ? (
                <span
                  className={cn('mx-2 h-0.5 w-full rounded-full', isComplete ? 'bg-highlight' : 'bg-border')}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
