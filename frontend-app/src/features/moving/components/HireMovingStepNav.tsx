import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

type HireMovingStepNavProps = {
  /** Leave out on the first step, where there is nothing to go back to. */
  onBack?: () => void
  /** The step's forward button: Continue, or the final confirm button. */
  children: ReactNode
}

/** The row at the bottom of every moving step: Back on the left, the forward button on the right. */
export function HireMovingStepNav({ onBack, children }: HireMovingStepNavProps) {
  const { t } = useTranslation()

  return (
    <div className="flex w-full items-center justify-between gap-3 border-t pt-6">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          {t('moving.back')}
        </Button>
      ) : (
        <span aria-hidden />
      )}
      {children}
    </div>
  )
}
