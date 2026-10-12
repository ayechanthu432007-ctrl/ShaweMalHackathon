import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { recommendationsApi, type ListingDraft, type PotentialTenant } from '../api/recommendations-api'
import { MatchReasons, MatchScore } from './MatchDetails'

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

function TenantRow({ tenant, rank }: { tenant: PotentialTenant; rank: number }) {
  const { t } = useTranslation()
  const [showProfile, setShowProfile] = useState(false)
  const { user, lookingFor, match } = tenant
  const photo = resolvePublicUploadUrl(user.profilePicturePath)
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

  return (
    <li className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 w-5 shrink-0 text-sm font-semibold text-muted-foreground">{rank}.</span>
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
        <Button type="button" variant="outline" size="sm" aria-expanded={showProfile} onClick={() => setShowProfile((open) => !open)}>
          {showProfile ? t('match.hideProfile') : t('match.viewProfile')}
        </Button>
      </div>
      <MatchScore match={match} />
      <MatchReasons match={match} subject="tenant" limit={4} />
      {match.missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('match.notCompared', { factors: match.missing.map((key) => t(`match.factors.${key}`, { defaultValue: key })).join(', ') })}
        </p>
      ) : null}
      {showProfile ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm">
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

/**
 * Shown above the Post button: the people this listing would suit, recalculated as the
 * agent fills in the form. It informs the agent and never blocks publishing.
 */
export function TenantCompatibility({ draft }: { draft: ListingDraft }) {
  const { t } = useTranslation()
  const debounced = useDebounced(JSON.stringify(draft), 700)
  const ready = draft.monthlyFees > 0 && Boolean(draft.cityId)

  const query = useQuery({
    queryKey: ['recommendations', 'tenant-matches', debounced],
    enabled: ready,
    queryFn: () => recommendationsApi.tenantMatches(JSON.parse(debounced) as ListingDraft),
    placeholderData: (previous) => previous,
  })

  return (
    <section className="space-y-3 rounded-xl border bg-muted/30 p-4" aria-label={t('match.tenants.title')}>
      <div>
        <h2 className="text-lg font-semibold">{t('match.tenants.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('match.tenants.subtitle')}</p>
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

      {ready && query.data && query.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('match.tenants.empty')}</p>
      ) : null}

      {ready && query.data && query.data.items.length > 0 ? (
        <>
          <ol className="space-y-2">
            {query.data.items.map((tenant, index) => (
              <TenantRow key={tenant.user.id} tenant={tenant} rank={index + 1} />
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            {t('match.tenants.count', { shown: query.data.items.length, total: query.data.total })} {t('match.disclaimer')}
          </p>
        </>
      ) : null}
    </section>
  )
}
