import { BadgeCheck, IdCard, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { SellerBadge } from '../types'

const BADGE_STYLES: Record<SellerBadge, { icon: typeof Phone; className: string }> = {
  PHONE_VERIFIED: { icon: Phone, className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  IDENTITY_VERIFIED: { icon: IdCard, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  TRUSTED_SELLER: { icon: BadgeCheck, className: 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300' },
}

type SellerBadgesProps = {
  badges: SellerBadge[]
  /** Compact mode shows only the strongest badge (for cards). */
  compact?: boolean
  showDescriptions?: boolean
  className?: string
}

export function SellerBadges({ badges, compact = false, showDescriptions = false, className }: SellerBadgesProps) {
  const { t } = useTranslation()
  const shown = compact ? badges.slice(-1) : badges

  if (shown.length === 0) {
    return compact ? null : (
      <p className={cn('text-xs text-muted-foreground', className)}>{t('marketplace.badges.none')}</p>
    )
  }

  return (
    <ul className={cn('flex flex-wrap gap-1.5', showDescriptions && 'flex-col gap-2', className)}>
      {shown.map((badge) => {
        const { icon: Icon, className: badgeClass } = BADGE_STYLES[badge]
        return (
          <li key={badge} className={cn(showDescriptions && 'flex flex-col gap-0.5')}>
            <span
              className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', badgeClass)}
              title={t(`marketplace.badges.${badge}.description`)}
            >
              <Icon className="size-3.5" aria-hidden />
              {t(`marketplace.badges.${badge}.label`)}
            </span>
            {showDescriptions ? (
              <span className="text-xs text-muted-foreground">{t(`marketplace.badges.${badge}.description`)}</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
