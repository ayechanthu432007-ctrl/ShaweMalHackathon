import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { isHouseAvailable } from '../lib/availability'

export function HouseAvailabilityBadge({
  availability,
  className,
}: {
  availability?: string | null
  className?: string
}) {
  const { t } = useTranslation()
  const available = isHouseAvailable(availability)

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        available ? 'bg-success-soft text-success ring-1 ring-success/20' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {available ? t('houses.available') : t('houses.notAvailable')}
    </span>
  )
}
