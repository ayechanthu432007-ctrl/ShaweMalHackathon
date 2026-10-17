import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Banknote, Bell, CircleCheck, Home, Lock, Search, Store, Truck, Users, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'

import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/common/PageStates'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StarRating } from '@/features/reviews/components/StarRating'

import { homeApi } from '../api/home-api'
import { HouseCarousel } from '../components/HouseCarousel'
import { RotatingLogo } from '../components/RotatingLogo'

const newPlaceItems: { icon: LucideIcon; titleKey: string; bodyKey: string }[] = [
  { icon: Home, titleKey: 'home.newPlaceItem1Title', bodyKey: 'home.newPlaceItem1Body' },
  { icon: CircleCheck, titleKey: 'home.newPlaceItem2Title', bodyKey: 'home.newPlaceItem2Body' },
  { icon: Store, titleKey: 'home.newPlaceItemMarketTitle', bodyKey: 'home.newPlaceItemMarketBody' },
  { icon: Banknote, titleKey: 'home.newPlaceItem3Title', bodyKey: 'home.newPlaceItem3Body' },
  { icon: Lock, titleKey: 'home.newPlaceItem4Title', bodyKey: 'home.newPlaceItem4Body' },
]

const howItWorksSteps: {
  icon: LucideIcon
  tileClass: string
  lineClass: string
  arrowClass: string
  titleKey: string
  bodyKey: string
  /** A step that is a feature of its own links to it. */
  to?: string
}[] = [
  {
    icon: Search,
    tileClass: 'bg-gradient-to-br from-violet-500 to-purple-600',
    lineClass: 'border-amber-400',
    arrowClass: 'border-l-amber-400',
    titleKey: 'home.howItWorksStep1Title',
    bodyKey: 'home.howItWorksStep1Body',
  },
  {
    icon: Users,
    tileClass: 'bg-gradient-to-br from-pink-400 to-rose-500',
    lineClass: 'border-pink-400',
    arrowClass: 'border-l-pink-400',
    titleKey: 'home.howItWorksStep2Title',
    bodyKey: 'home.howItWorksStep2Body',
  },
  {
    icon: Truck,
    tileClass: 'bg-gradient-to-br from-sky-400 to-blue-500',
    lineClass: 'border-sky-400',
    arrowClass: 'border-l-sky-400',
    titleKey: 'home.howItWorksStep3Title',
    bodyKey: 'home.howItWorksStep3Body',
  },
  {
    icon: Store,
    tileClass: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    lineClass: 'border-emerald-400',
    arrowClass: 'border-l-emerald-400',
    titleKey: 'home.howItWorksMarketTitle',
    bodyKey: 'home.howItWorksMarketBody',
    to: '/marketplace',
  },
  {
    icon: Bell,
    tileClass: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    lineClass: '',
    arrowClass: '',
    titleKey: 'home.howItWorksStep4Title',
    bodyKey: 'home.howItWorksStep4Body',
  },
]

export function HomePage() {
  const { t } = useTranslation()

  const homeQuery = useQuery({
    queryKey: ['home'],
    queryFn: () => homeApi.getContent(),
  })

  return (
    <section className="space-y-10">
      <div className="space-y-4 rounded-2xl border bg-gradient-to-br from-brand-sky-soft via-background to-background p-6 shadow-card sm:p-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('home.heroTitle')}</h1>
          <p className="max-w-2xl text-lg font-medium text-foreground">{t('home.heroSubtitle')}</p>
          <p className="max-w-2xl text-muted-foreground">{t('home.heroContent')}</p>
        </div>
      </div>

      {homeQuery.isLoading ? (
        // Same heading and one-row shape as the loaded Popular Houses carousel, so nothing jumps.
        <HomeSection title={t('home.popularTitle')} subtitle={t('home.popularSubtitle')}>
          <CardGridSkeleton
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*:nth-child(n+2)]:hidden sm:[&>*:nth-child(2)]:flex lg:[&>*:nth-child(3)]:flex"
            withControls
          />
        </HomeSection>
      ) : null}

      {homeQuery.isError ? <ErrorState message={t('home.loadError')} onRetry={() => void homeQuery.refetch()} /> : null}

      {homeQuery.data ? (
        <>
          <HomeSection title={t('home.popularTitle')} subtitle={t('home.popularSubtitle')}>
            {homeQuery.data.popularRecommended.length === 0 ? (
              <EmptyHint text={t('home.emptyPopular')} />
            ) : (
              <HouseCarousel houses={homeQuery.data.popularRecommended} label={t('home.popularTitle')} />
            )}
          </HomeSection>

          <YourNewPlaceSection />

          <HowShaweMalWorksSection />

          <HomeSection title={t('home.newsTitle')}>
            {homeQuery.data.newsUpdates.length === 0 ? (
              <EmptyHint text={t('home.emptyNews')} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {homeQuery.data.newsUpdates.map((item) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </HomeSection>

          <HomeSection title={t('home.agentsTitle')}>
            {homeQuery.data.verifiedAgents.length === 0 ? (
              <EmptyHint text={t('home.emptyAgents')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {homeQuery.data.verifiedAgents.map((agent) => (
                  <Card key={agent.id}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <UserAvatar path={agent.profilePicturePath} name={agent.name} className="size-11" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{agent.name}</p>
                          {agent.hasVerifiedBadge ? (
                            <Badge tone="info">
                              <BadgeCheck aria-hidden />
                              {t('home.verifiedBadge')}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {agent.agentProfile?.city?.name ?? t('houses.locationUnknown')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </HomeSection>

          <HomeSection title={t('home.movingPartnersTitle')}>
            {homeQuery.data.partnerMovingServices.length === 0 ? (
              <EmptyHint text={t('home.emptyMoving')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {homeQuery.data.partnerMovingServices.map((partner) => (
                  <Card key={partner.id}>
                    <CardContent className="space-y-1 p-4">
                      <p className="font-medium">{partner.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {partner.driverProfile?.companyName ||
                          partner.driverProfile?.vehicleType?.name ||
                          t('home.movingPartnerFallback')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </HomeSection>

          <HomeSection title={t('home.reviewsTitle')}>
            {homeQuery.data.serviceReviews.length === 0 ? (
              <EmptyHint text={t('home.emptyReviews')} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {homeQuery.data.serviceReviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRating value={review.rating} readOnly size="sm" />
                        {review.targetUser?.name ? (
                          <p className="text-sm font-medium">{review.targetUser.name}</p>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {review.comment?.trim() || t('home.reviewNoComment')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {review.reviewer?.name ?? t('home.anonymousReviewer')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </HomeSection>

          <div className="rounded-2xl border bg-card p-6 text-center shadow-card">
            <p className="text-sm text-muted-foreground">{t('home.browseHint')}</p>
            <Button asChild variant="cta" size="lg" className="mt-4">
              <Link to="/finding-house">{t('nav.findingHouse')}</Link>
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function YourNewPlaceSection() {
  const { t } = useTranslation()

  return (
    <section className="overflow-hidden rounded-2xl bg-surface-warm text-foreground dark:bg-muted">
      <div className="grid lg:grid-cols-2">
        <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-12">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('home.newPlaceTitle')}</h2>
            <p className="text-muted-foreground">{t('home.newPlaceSubtitle')}</p>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t('home.newPlaceIntro')}</p>
          </div>
          <ul className="space-y-7">
            {newPlaceItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.titleKey} className="flex gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-md dark:bg-card">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <div className="space-y-1 pt-0.5">
                    <p className="font-semibold">{t(item.titleKey)}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-gradient-to-br from-surface-warm via-surface-warm-2 to-surface-warm-3 p-8 lg:min-h-full lg:rounded-tl-[8rem] dark:from-muted dark:via-card dark:to-secondary">
          <div className="pointer-events-none absolute -right-10 top-6 size-56 rounded-full bg-primary/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-4 left-6 size-44 rounded-full bg-sky-300/35 blur-3xl dark:bg-sky-400/20" />
          <RotatingLogo alt={t('home.newPlaceLogoAlt')} className="z-10" />
        </div>
      </div>
    </section>
  )
}

function HowShaweMalWorksSection() {
  const { t } = useTranslation()

  return (
    <section className="space-y-10 py-4">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        <Trans
          i18nKey="home.howItWorksTitle"
          components={{ brand: <span className="text-primary" /> }}
        />
      </h2>
      <ol className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-6">
        {howItWorksSteps.map((step, index) => {
          const Icon = step.icon
          const isLast = index === howItWorksSteps.length - 1
          return (
            <li key={step.titleKey} className="relative flex flex-col items-center px-2 text-center">
              {!isLast ? (
                <div
                  className={`pointer-events-none absolute top-7 left-[calc(50%+2.25rem)] hidden h-0 w-[calc(100%-4.5rem)] border-t-2 border-dashed lg:block ${step.lineClass}`}
                >
                  <span
                    className={`absolute -right-1.5 -top-[5px] border-y-[5px] border-l-8 border-y-transparent ${step.arrowClass}`}
                  />
                </div>
              ) : null}
              <span
                className={`flex size-14 items-center justify-center rounded-2xl shadow-md ${step.tileClass}`}
              >
                <Icon className="size-7 text-white" aria-hidden />
              </span>
              <p className="mt-4 font-semibold text-foreground">
                {step.to ? (
                  <Link to={step.to} className="underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t(step.titleKey)}
                  </Link>
                ) : (
                  t(step.titleKey)
                )}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(step.bodyKey)}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function HomeSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <EmptyState text={text} />
}
