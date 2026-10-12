import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { recommendationsApi } from '../api/recommendations-api'
import { MatchReasons, MatchScore } from './MatchDetails'

const formatFees = (amount: number) => new Intl.NumberFormat('en-US').format(amount)

/** The homes that best fit the signed-in person, calculated from their saved preferences. */
export function RecommendedHouses() {
  const { t } = useTranslation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()

  const query = useQuery({
    queryKey: ['recommendations', 'houses', user?.id],
    enabled: isAuthenticated,
    queryFn: () => recommendationsApi.houses(),
  })

  if (isBootstrapping) return null

  const heading = (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">
        {isAuthenticated && user?.name ? t('match.houses.titleFor', { name: user.name }) : t('match.houses.title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('match.houses.subtitle')}</p>
    </div>
  )

  if (!isAuthenticated) {
    return (
      <section className="space-y-3" aria-label={t('match.houses.title')}>
        {heading}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('match.houses.signIn')}</p>
          <Button asChild size="sm">
            <Link to="/sign-in" state={{ from: '/finding-house' }}>
              {t('nav.signIn')}
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  const data = query.data
  const needsProfile = data && (!data.hasPreferences || !data.hasOccupation)

  return (
    <section className="space-y-3" aria-label={t('match.houses.title')}>
      {heading}

      {query.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

      {query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t('match.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {needsProfile ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('match.completeProfile')}</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/profile#housing-preferences">{t('match.setPreferences')}</Link>
          </Button>
        </div>
      ) : null}

      {data && data.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('match.houses.empty')}</p> : null}

      {data && data.items.length > 0 ? (
        <ul className="flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
          {data.items.map(({ house, match }) => {
            const thumbnail = resolvePublicUploadUrl(house.thumbnail)
            return (
              <li key={house.id} className="w-64 shrink-0 snap-start lg:w-auto">
                <Card className="flex h-full flex-col overflow-hidden">
                  <div className="aspect-[2/1] bg-muted">
                    {thumbnail ? (
                      <img src={thumbnail} alt={house.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('houses.noPhoto')}</div>
                    )}
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-1.5 p-3">
                    <MatchScore match={match} />
                    <h3 className="line-clamp-1 text-sm font-semibold leading-snug" title={house.title}>
                      {house.title}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {[house.city?.name, house.propertyType?.name, t('match.houses.bedrooms', { count: house.bedrooms })].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-sm font-semibold text-primary">{t('houses.monthlyFees', { amount: formatFees(house.monthlyFees) })}</p>
                    {house.amenities.length > 0 ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {house.amenities.slice(0, 3).join(' · ')}
                        {house.amenities.length > 3 ? ` +${house.amenities.length - 3}` : ''}
                      </p>
                    ) : null}
                    <MatchReasons match={match} subject="house" compact />
                    <Button asChild size="sm" variant="outline" className="mt-auto h-8 w-full">
                      <Link to={`/houses/${house.id}`}>{t('match.viewDetails')}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : null}

      {data && data.items.length > 0 ? <p className="text-xs text-muted-foreground">{t('match.disclaimer')}</p> : null}
    </section>
  )
}
