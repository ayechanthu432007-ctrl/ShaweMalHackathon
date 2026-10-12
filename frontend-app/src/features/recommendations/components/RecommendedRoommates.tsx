import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { recommendationsApi, type RecommendedRoommate } from '../api/recommendations-api'
import { MatchReasons, MatchScore } from './MatchDetails'

function RoommateMatchCard({ item }: { item: RecommendedRoommate }) {
  const { t } = useTranslation()
  const [showProfile, setShowProfile] = useState(false)
  const { post, match } = item
  const photo = resolvePublicUploadUrl(post.user.profilePicturePath) ?? resolvePublicUploadUrl(post.photos[0])
  const phone = post.user.phone?.replace(/\s+/g, '')

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {photo ? (
            <img src={photo} alt="" loading="lazy" className="size-12 shrink-0 rounded-full border border-input object-cover" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold" aria-hidden>
              {post.user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate font-medium">{post.user.name}</p>
            <p className="text-sm text-muted-foreground">{post.occupation?.name ?? t('roommates.occupationUnknown')}</p>
          </div>
        </div>
        <MatchScore match={match} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('match.roommates.location')}</dt>
          <dd>{[post.house.city?.name, post.house.state?.name].filter(Boolean).join(', ') || t('houses.locationUnknown')}</dd>
          <dt className="text-muted-foreground">{t('match.roommates.budget')}</dt>
          <dd>{post.budgetCostSharing}</dd>
        </dl>
        <MatchReasons match={match} subject="roommate" limit={3} />
        {showProfile ? (
          <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{post.title}</p>
            <p className="text-muted-foreground">{t('match.roommates.home', { title: post.house.title })}</p>
            {match.missing.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('match.notCompared', { factors: match.missing.map((key) => t(`match.factors.${key}`, { defaultValue: key })).join(', ') })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" aria-expanded={showProfile} onClick={() => setShowProfile((open) => !open)}>
            {showProfile ? t('match.hideProfile') : t('match.viewProfile')}
          </Button>
          {phone ? (
            <Button asChild size="sm">
              <a href={`tel:${phone}`}>{t('match.contact')}</a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/** Roommate posts ranked for the signed-in person, most compatible first. */
export function RecommendedRoommates() {
  const { t } = useTranslation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()

  const query = useQuery({
    queryKey: ['recommendations', 'roommates', user?.id],
    enabled: isAuthenticated,
    queryFn: () => recommendationsApi.roommates(),
  })

  if (isBootstrapping) return null

  const heading = (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{t('match.roommates.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('match.roommates.subtitle')}</p>
    </div>
  )

  if (!isAuthenticated) {
    return (
      <section className="space-y-3" aria-label={t('match.roommates.title')}>
        {heading}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('match.roommates.signIn')}</p>
          <Button asChild size="sm">
            <Link to="/sign-in" state={{ from: '/finding-roommates' }}>
              {t('nav.signIn')}
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  const data = query.data

  return (
    <section className="space-y-3" aria-label={t('match.roommates.title')}>
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

      {data && !data.hasPreferences ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t('match.completeProfile')}</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/profile#housing-preferences">{t('match.setPreferences')}</Link>
          </Button>
        </div>
      ) : null}

      {data && data.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('match.roommates.empty')}</p> : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <RoommateMatchCard key={item.post.id} item={item} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('match.disclaimer')}</p>
        </>
      ) : null}
    </section>
  )
}
