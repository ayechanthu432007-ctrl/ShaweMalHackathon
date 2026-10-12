import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { MatchSummary } from '../api/recommendations-api'

function scoreTone(score: number): string {
  if (score >= 75) return 'bg-emerald-600'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-muted-foreground'
}

/** The compatibility percentage with a progress bar and, when it applies, a confidence note. */
export function MatchScore({ match, className }: { match: MatchSummary; className?: string }) {
  const { t } = useTranslation()

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-sm font-semibold">{t('match.score', { score: match.score })}</span>
        {match.confidence !== 'HIGH' ? (
          <span className="truncate rounded-full border border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t(`match.confidence.${match.confidence}`)}
          </span>
        ) : null}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={match.score}
        aria-label={t('match.scoreLabel')}
      >
        <div className={cn('h-full rounded-full', scoreTone(match.score))} style={{ width: `${match.score}%` }} />
      </div>
    </div>
  )
}

type MatchReasonsProps = {
  match: MatchSummary
  /** How many matching factors to name. */
  limit?: number
  /** Which wording to use for the sentence: a home for a person, or two people. */
  subject: 'house' | 'roommate' | 'tenant'
  /** Small cards keep the sentence for screen readers and show only the chips. */
  compact?: boolean
}

/** Why the score is what it is: what matched, and what conflicts. */
export function MatchReasons({ match, limit = 3, subject, compact = false }: MatchReasonsProps) {
  const { t } = useTranslation()
  const label = (key: string) => t(`match.factors.${key}`, { defaultValue: key })
  const matched = match.matched.slice(0, limit)

  return (
    <div className="space-y-1.5 text-xs">
      <p className={compact && (matched.length > 0 || match.conflicts.length > 0) ? 'sr-only' : 'text-muted-foreground'}>
        {matched.length > 0
          ? t(`match.why.${subject}`, { factors: matched.map(label).join(', ') })
          : t(match.confidence === 'INCOMPLETE' ? 'match.whyIncomplete' : 'match.whyNone')}
      </p>
      {matched.length > 0 || match.conflicts.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {matched.map((key) => (
            <li key={key} className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" aria-hidden />
              {label(key)}
            </li>
          ))}
          {match.conflicts.map((key) => (
            <li key={key} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
              <X className="size-3" aria-hidden />
              <span className="sr-only">{t('match.conflict')}: </span>
              {label(key)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
