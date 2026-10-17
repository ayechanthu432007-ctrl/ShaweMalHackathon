import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDown, ArrowUp, Info, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { recommendationsApi, type ListingDraft, type OccupationCompatibility, type OccupationDraft } from '../api/recommendations-api'

const STRONG = 75
const MEDIUM = 50
type Tier = 'HIGH' | 'MEDIUM' | 'LOW'
const tierOf = (score: number): Tier => (score >= STRONG ? 'HIGH' : score >= MEDIUM ? 'MEDIUM' : 'LOW')
const BAR: Record<Tier, string> = { HIGH: 'bg-success', MEDIUM: 'bg-warning', LOW: 'bg-destructive' }
const TONE: Record<Tier, 'success' | 'warning' | 'danger'> = { HIGH: 'success', MEDIUM: 'warning', LOW: 'danger' }

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** Only the fields that affect occupation compatibility, so unrelated edits do not refetch. */
const toOccupationDraft = (draft: ListingDraft): OccupationDraft => ({
  monthlyFees: draft.monthlyFees || undefined,
  bedrooms: draft.bedrooms || undefined,
  bathrooms: draft.bathrooms || undefined,
  areaSize: draft.areaSize || undefined,
  amenityIds: draft.amenityIds ?? [],
  nearbyPlaces: draft.nearbyPlaces || undefined,
  description: draft.description || undefined,
  houseRules: draft.houseRules || undefined,
})

function OccupationRow({ item }: { item: OccupationCompatibility }) {
  const { t } = useTranslation()
  const tier = item.score === null ? null : tierOf(item.score)

  return (
    <li className="space-y-2 rounded-xl border bg-card p-3" data-testid="occupation-row">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-medium">{item.name}</p>
        {item.score !== null && tier ? (
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-lg font-semibold tabular-nums">{item.score}%</span>
            <Badge tone={TONE[tier]} size="xs">
              {t(`match.tenants.tier.${tier}`)}
            </Badge>
          </span>
        ) : (
          <span className="shrink-0 text-sm text-muted-foreground">{t('match.occupations.notEnough')}</span>
        )}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.score ?? 0}
        aria-label={t('match.occupations.scoreLabel', { name: item.name })}
      >
        {item.score !== null && tier ? (
          <div className={cn('h-full rounded-full transition-[width] duration-300', BAR[tier])} style={{ width: `${item.score}%` }} />
        ) : null}
      </div>
      {item.reasons.length > 0 ? (
        <ul className="space-y-0.5 text-xs">
          {item.reasons.map((reason) => {
            const Icon = reason.effect === 'up' ? ArrowUp : reason.effect === 'down' ? ArrowDown : Minus
            const [group, code] = reason.code.split('.')
            return (
              <li key={reason.code} className="flex items-start gap-1.5">
                <Icon
                  className={cn('mt-0.5 size-3.5 shrink-0', reason.effect === 'up' ? 'text-success' : reason.effect === 'down' ? 'text-destructive' : 'text-muted-foreground')}
                  aria-hidden
                />
                <span>
                  <span className="sr-only">{t(`match.occupations.effect.${reason.effect}`)}: </span>
                  {t(`match.occupations.reason.${group}.${code}`, reason.params)}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
      {item.missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('match.occupations.missing', { details: item.missing.map((key) => t(`match.occupations.factor.${key}`)).join(', ') })}
        </p>
      ) : null}
    </li>
  )
}

/** Every occupation category with a compatibility score for the listing as currently typed. */
export function OccupationCompatibilityList({ draft }: { draft: ListingDraft }) {
  const { t } = useTranslation()
  const current = JSON.stringify(toOccupationDraft(draft))
  const debounced = useDebounced(current, 500)
  const [showMethod, setShowMethod] = useState(false)

  const query = useQuery({
    queryKey: ['recommendations', 'occupation-compatibility', debounced],
    queryFn: () => recommendationsApi.occupationCompatibility(JSON.parse(debounced) as OccupationDraft),
    placeholderData: (previous) => previous,
  })
  const data = query.data
  const updating = debounced !== current || query.isFetching
  const limited = data?.items.some((item) => item.limited)

  return (
    <div className="space-y-3" aria-busy={updating}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('match.occupations.subtitle')}</p>
        {data ? (
          <span className="text-xs text-muted-foreground" role="status">
            {updating ? t('match.tenants.updating') : t('match.tenants.basisDraft')}
          </span>
        ) : null}
      </div>

      {query.isLoading ? <p className="text-sm text-muted-foreground">{t('match.tenants.analysing')}</p> : null}
      {query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-destructive">{t('match.tenants.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {data && limited ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('match.occupations.limited')}
        </p>
      ) : null}

      {data ? (
        <ol className={cn('grid gap-2 transition-opacity md:grid-cols-2', updating && 'opacity-60')} aria-label={t('match.occupations.listLabel')}>
          {data.items.map((item) => (
            <OccupationRow key={item.id} item={item} />
          ))}
        </ol>
      ) : null}

      {data ? (
        <div>
          <Button type="button" variant="link" size="sm" className="h-auto px-0" aria-expanded={showMethod} onClick={() => setShowMethod((open) => !open)}>
            <Info aria-hidden />
            {t('match.tenants.howCalculated')}
          </Button>
          {showMethod ? (
            <div className="mt-2 space-y-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
              <p>{t('match.occupations.method.intro')}</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {(Object.keys(data.method.weights) as Array<keyof typeof data.method.weights>).map((key) => (
                  <li key={key} className="flex justify-between gap-2">
                    <span>{t(`match.occupations.factor.${key}`)}</span>
                    <span className="font-medium text-foreground">{data.method.weights[key]}</span>
                  </li>
                ))}
              </ul>
              <p>{t('match.occupations.method.emphasis')}</p>
              <p>{t('match.occupations.method.affordability', { rent: data.typicalRent ? new Intl.NumberFormat('en-US').format(data.typicalRent) : '—' })}</p>
              <p>{t('match.occupations.method.missing', { min: data.method.minJudgedShare })}</p>
              <p>{t('match.occupations.method.fairness')}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
