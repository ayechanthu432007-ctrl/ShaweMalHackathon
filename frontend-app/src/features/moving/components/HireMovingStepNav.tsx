import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

/** The one look every moving step's forward button shares: brand yellow (#FFDE59) with dark text. */
export const MOVING_FORWARD_BUTTON_CLASS =
  'h-11 min-w-32 rounded-lg bg-highlight px-6 text-base font-semibold text-[#222222] shadow-sm transition-[background-color,transform] hover:bg-highlight/85 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#222222] focus-visible:ring-offset-2 disabled:bg-highlight/50 disabled:text-[#222222]/60'

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
