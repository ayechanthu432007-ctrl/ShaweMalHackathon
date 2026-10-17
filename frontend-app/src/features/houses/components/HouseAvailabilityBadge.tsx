import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
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
    <Badge tone={available ? 'success' : 'neutral'} className={cn('px-2.5', available && 'border-success/20', className)}>
      {available ? t('houses.available') : t('houses.notAvailable')}
    </Badge>
  )
}
