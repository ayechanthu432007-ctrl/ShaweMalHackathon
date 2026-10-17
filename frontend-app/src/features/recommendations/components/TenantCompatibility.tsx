import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, CircleHelp, Info, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

import { OccupationCompatibilityList } from './OccupationCompatibility'
import {
  recommendationsApi,
  type CompatibilityTier,
  type ListingDraft,
  type PotentialTenant,
  type TenantMatches,
  type TenantReason,
} from '../api/recommendations-api'

const formatFees = (amount: number) => new Intl.NumberFormat('en-US').format(amount)

/** Waits until the agent pauses typing before the listing is analysed again. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const TIER_BAR: Record<CompatibilityTier, string> = {
  HIGH: 'bg-success',
  MEDIUM: 'bg-warning',
  LOW: 'bg-destructive',
}
const TIER_BADGE: Record<CompatibilityTier, 'success' | 'warning' | 'danger'> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'danger',
}
const tierOf = (score: number, thresholds: TenantMatches['method']['thresholds']): CompatibilityTier =>
  score >= thresholds.strong ? 'HIGH' : score >= thresholds.medium ? 'MEDIUM' : 'LOW'

/** A labelled 0–100 bar coloured by compatibility band. */
function ScoreBar({ score, tier, label, large = false }: { score: number; tier: CompatibilityTier; label: string; large?: boolean }) {
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-muted', large ? 'h-2.5' : 'h-1.5')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-300', TIER_BAR[tier])} style={{ width: `${score}%` }} />
    </div>
  )
}

function ReasonLine({ reason }: { reason: TenantReason }) {
  const { t } = useTranslation()
  const params = { ...reason.params, ...(typeof reason.params?.over === 'number' ? { over: formatFees(reason.params.over) } : {}) }
  const Icon = reason.status === 'match' ? Check : reason.status === 'partial' ? Minus : X
  return (
    <li className="flex items-start gap-1.5">
      <Icon
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          reason.status === 'match' ? 'text-success' : reason.status === 'partial' ? 'text-warning' : 'text-destructive',
        )}
        aria-hidden
      />
      <span>
        <span className="sr-only">{t(`match.tenants.status.${reason.status}`)}: </span>
        {t(`match.tenants.reason.${reason.code}`, params)}
      </span>
    </li>
  )
}

function TenantRow({ tenant, rank, thresholds }: { tenant: PotentialTenant; rank: number; thresholds: TenantMatches['method']['thresholds'] }) {
  const { t } = useTranslation()
  const [showProfile, setShowProfile] = useState(false)
  const { user, lookingFor, match } = tenant
  const photo = resolvePublicUploadUrl(user.profilePicturePath)
  const tier = match.tier ?? tierOf(match.score, thresholds)
  const budget =
    lookingFor.budgetMax != null
      ? lookingFor.budgetMin != null
        ? `${formatFees(lookingFor.budgetMin)} – ${formatFees(lookingFor.budgetMax)} MMK`
        : t('match.tenants.upTo', { amount: formatFees(lookingFor.budgetMax) })
      : null
  const facts: Array<[string, string | null]> = [
    [t('match.tenants.wantsCity'), lookingFor.preferredCity],
    [t('match.tenants.wantsBudget'), budget],
    [t('match.tenants.wantsType'), lookingFor.propertyType],
    [t('match.tenants.wantsBedrooms'), lookingFor.bedroomsMin != null ? String(lookingFor.bedroomsMin) : null],
    [t('match.tenants.wantsMoveIn'), lookingFor.moveInDate ? new Date(lookingFor.moveInDate).toLocaleDateString() : null],
    [t('match.tenants.wantsLease'), lookingFor.leaseMonths != null ? t('match.months', { count: lookingFor.leaseMonths }) : null],
  ]
  const positives = match.reasons.filter((reason) => reason.status === 'match')
  const problems = match.reasons.filter((reason) => reason.status !== 'match')

  return (
    <li className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2 w-5 shrink-0 text-sm font-semibold text-muted-foreground">{rank}.</span>
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="size-10 shrink-0 rounded-full border border-input object-cover" />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold" aria-hidden>
            {user.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.occupation ?? t('roommates.occupationUnknown')}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums">{match.score}%</p>
          <Badge tone={TIER_BADGE[tier]} size="xs">
            {t(`match.tenants.tier.${tier}`)}
          </Badge>
        </div>
      </div>
      <ScoreBar score={match.score} tier={tier} label={t('match.tenants.personScoreLabel', { name: user.name })} />
      {match.confidence === 'LOW' ? <p className="text-xs text-muted-foreground">{t('match.tenants.lowConfidence')}</p> : null}

      <div className="grid gap-3 text-xs sm:grid-cols-2">
        {positives.length > 0 ? (
          <div>
            <p className="mb-1 font-semibold text-success-ink">{t('match.tenants.positives')}</p>
            <ul className="space-y-1">
              {positives.map((reason, index) => (
                <ReasonLine key={`${reason.code}-${index}`} reason={reason} />
              ))}
            </ul>
          </div>
        ) : null}
        {problems.length > 0 ? (
          <div>
            <p className="mb-1 font-semibold text-destructive">{t('match.tenants.mismatches')}</p>
            <ul className="space-y-1">
              {problems.map((reason, index) => (
                <ReasonLine key={`${reason.code}-${index}`} reason={reason} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {match.missing.length > 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('match.tenants.notStatedFactors', { factors: match.missing.map((key) => t(`match.tenants.factor.${key}`)).join(', ') })}
        </p>
      ) : null}

      <Button type="button" variant="outline" size="sm" aria-expanded={showProfile} onClick={() => setShowProfile((open) => !open)}>
        {showProfile ? t('match.hideProfile') : t('match.viewProfile')}
      </Button>
      {showProfile ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value ?? t('match.notStated')}</dd>
            </div>
          ))}
          <p className="col-span-2 pt-1 text-xs text-muted-foreground">{t('match.tenants.privacy')}</p>
        </dl>
      ) : null}
    </li>
  )
}

function Summary({ data }: { data: TenantMatches }) {
  const { t } = useTranslation()
  const { thresholds, weights } = data.method
  const overall = data.overallScore
  const overallTier = overall === null ? null : tierOf(overall, thresholds)
  const [showMethod, setShowMethod] = useState(false)

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('match.tenants.overall')}</p>
          {overall !== null && overallTier ? (
            <p className="flex items-center gap-2">
              <span className="text-4xl font-bold tabular-nums">{overall}%</span>
              <Badge tone={TIER_BADGE[overallTier]}>{t(`match.tenants.tier.${overallTier}`)}</Badge>
            </p>
          ) : (
            <p className="text-lg font-semibold">{t('match.tenants.insufficientShort')}</p>
          )}
        </div>
        {data.bestScore !== null ? (
          <p className="text-sm text-muted-foreground">{t('match.tenants.best', { score: data.bestScore })}</p>
        ) : null}
      </div>
      {overall !== null && overallTier ? <ScoreBar score={overall} tier={overallTier} label={t('match.tenants.overall')} large /> : null}
      {overall !== null ? <p className="text-xs text-muted-foreground">{t('match.tenants.overallExplained', { count: data.scoredCount })}</p> : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [t('match.tenants.evaluated'), data.evaluated],
          [t('match.tenants.strong'), data.strongMatches],
          [t('match.tenants.scored'), data.scoredCount],
          [t('match.tenants.insufficient'), data.insufficient],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-muted/30 p-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {data.scoredCount > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t('match.tenants.byFactor')}</p>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {data.factorSummary.map((row) => {
              const judged = row.match + row.partial + row.conflict
              return (
                <li key={row.key} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                  <span>{t(`match.tenants.factor.${row.key}`)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {judged === 0
                      ? t('match.tenants.factorNotStated')
                      : t('match.tenants.factorCounts', { match: row.match, partial: row.partial, conflict: row.conflict })}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <Button type="button" variant="link" size="sm" className="h-auto px-0" aria-expanded={showMethod} onClick={() => setShowMethod((open) => !open)}>
          <Info aria-hidden />
          {t('match.tenants.howCalculated')}
        </Button>
        {showMethod ? (
          <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>{t('match.tenants.method.intro')}</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {(Object.keys(weights) as Array<keyof typeof weights>).map((key) => (
                <li key={key} className="flex justify-between gap-2">
                  <span>{t(`match.tenants.factor.${key}`)}</span>
                  <span className="font-medium text-foreground">{weights[key]}%</span>
                </li>
              ))}
            </ul>
            <p>{t('match.tenants.method.missing', { min: thresholds.minJudgedShare })}</p>
            <p>{t('match.tenants.method.penalties', { cap: thresholds.budgetConflictCap })}</p>
            <p>{t('match.tenants.method.bands', { strong: thresholds.strong, medium: thresholds.medium })}</p>
            <p>{t('match.tenants.method.occupation')}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Secondary view: individual people who chose to be suggested to agents, scored against their own
 * stated requirements. The main view is the occupation-category list above it.
 */
export function IndividualTenantMatches({ draft }: { draft: ListingDraft }) {
  const { t } = useTranslation()
  const debounced = useDebounced(JSON.stringify(draft), 700)
  const ready = draft.monthlyFees > 0 && Boolean(draft.cityId)
  const pending = ready && debounced !== JSON.stringify(draft)

  const query = useQuery({
    queryKey: ['recommendations', 'tenant-matches', debounced],
    enabled: ready,
    queryFn: () => recommendationsApi.tenantMatches(JSON.parse(debounced) as ListingDraft),
    placeholderData: (previous) => previous,
  })
  const data = query.data
  const updating = pending || query.isFetching

  return (
    <div className="space-y-3" aria-busy={updating}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('match.tenants.subtitle')}</p>
        {ready && data ? (
          <span className="text-xs text-muted-foreground" role="status">
            {updating ? t('match.tenants.updating') : t('match.tenants.basisDraft')}
          </span>
        ) : null}
      </div>

      {!ready ? <p className="text-sm text-muted-foreground">{t('match.tenants.needDetails')}</p> : null}
      {ready && query.isLoading ? <p className="text-sm text-muted-foreground">{t('match.tenants.analysing')}</p> : null}

      {ready && query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-destructive">{t('match.tenants.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {ready && data && data.evaluated === 0 ? (
        <p className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {t('match.tenants.noProfiles')}
        </p>
      ) : null}

      {ready && data && data.evaluated > 0 ? (
        <div className={cn('space-y-3 transition-opacity', updating && 'opacity-60')}>
          <Summary data={data} />
          {data.scoredCount === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {t('match.tenants.allInsufficient', { count: data.insufficient })}
            </p>
          ) : (
            <>
              <h3 className="text-sm font-semibold">{t('match.tenants.topMatches')}</h3>
              <ol className="space-y-2">
                {data.items.map((tenant, index) => (
                  <TenantRow key={tenant.user.id} tenant={tenant} rank={index + 1} thresholds={data.method.thresholds} />
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                {t('match.tenants.count', { shown: data.items.length, total: data.scoredCount })} {t('match.disclaimer')}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Shown above Save on the listing form: compatibility of the listing as currently typed with every
 * occupation category, plus (collapsed) the individual people who opted in to agent suggestions.
 * It informs the agent and never blocks saving.
 */
export function TenantCompatibility({ draft }: { draft: ListingDraft }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-4 rounded-xl border bg-muted/30 p-4" aria-labelledby="tenant-compat-title">
      <h2 id="tenant-compat-title" className="text-lg font-semibold tracking-tight">
        {t('match.tenants.title')}
      </h2>
      <OccupationCompatibilityList draft={draft} />
      <details className="group rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('match.tenants.individualTitle')}</summary>
        <div className="mt-3">
          <IndividualTenantMatches draft={draft} />
        </div>
      </details>
    </section>
  )
}
