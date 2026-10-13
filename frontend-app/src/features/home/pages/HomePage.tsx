import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Banknote, Bell, CircleCheck, Home, Lock, Search, Truck, Users, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'

import shawemalLogo from '@/assets/shawemal-logo.jpg'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HouseCard } from '@/features/houses/components/HouseCard'
import { StarRating } from '@/features/reviews/components/StarRating'

import { homeApi } from '../api/home-api'

const newPlaceItems: { icon: LucideIcon; titleKey: string; bodyKey: string }[] = [
  { icon: Home, titleKey: 'home.newPlaceItem1Title', bodyKey: 'home.newPlaceItem1Body' },
  { icon: CircleCheck, titleKey: 'home.newPlaceItem2Title', bodyKey: 'home.newPlaceItem2Body' },
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
      <div className="space-y-4 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('home.heroTitle')}</h1>
          <p className="max-w-2xl text-lg font-medium text-foreground">{t('home.heroSubtitle')}</p>
          <p className="max-w-2xl text-muted-foreground">{t('home.heroContent')}</p>
        </div>
      </div>

      {homeQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

      {homeQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t('home.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void homeQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {homeQuery.data ? (
        <>
          <HomeSection title={t('home.popularTitle')} subtitle={t('home.popularSubtitle')}>
            {homeQuery.data.popularRecommended.length === 0 ? (
              <EmptyHint text={t('home.emptyPopular')} />
            ) : (
              // One row that scrolls sideways (swipe on phones); the scrollbar itself is hidden.
              <ul
                aria-label={t('home.popularTitle')}
                tabIndex={0}
                className="-mx-1 flex snap-x gap-4 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
              >
                {homeQuery.data.popularRecommended.map((house) => (
                  <li key={house.id} className="w-[80%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]">
                    <HouseCard house={house} className="h-full" />
                  </li>
                ))}
              </ul>
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
                    <CardContent className="space-y-1 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{agent.name}</p>
                        {agent.hasVerifiedBadge ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <BadgeCheck className="size-3.5" aria-hidden />
                            {t('home.verifiedBadge')}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {agent.agentProfile?.city?.name ?? t('houses.locationUnknown')}
                      </p>
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

          <div className="rounded-xl border p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('home.browseHint')}</p>
            <Button asChild className="mt-3">
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
    <section className="overflow-hidden rounded-2xl bg-[#FAF6F4] text-[#1a2744] dark:bg-muted dark:text-foreground">
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
        <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#FAF6F4] via-[#F4E8DC] to-[#E8D4BE] p-8 lg:min-h-full lg:rounded-tl-[8rem] dark:from-muted dark:via-card dark:to-secondary">
          <div className="pointer-events-none absolute -right-10 top-6 size-56 rounded-full bg-primary/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-4 left-6 size-44 rounded-full bg-sky-300/35 blur-3xl dark:bg-sky-400/20" />
          <img
            src={shawemalLogo}
            alt={t('home.newPlaceLogoAlt')}
            className="relative z-10 max-h-80 w-full max-w-md object-contain drop-shadow-xl"
          />
        </div>
      </div>
    </section>
  )
}

function HowShaweMalWorksSection() {
  const { t } = useTranslation()

  return (
    <section className="space-y-10 py-4">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-[#1a2744] dark:text-foreground sm:text-3xl">
        <Trans
          i18nKey="home.howItWorksTitle"
          components={{ brand: <span className="text-primary" /> }}
        />
      </h2>
      <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorksSteps.map((step, index) => {
          const Icon = step.icon
          const isLast = index === howItWorksSteps.length - 1
          return (
            <li key={step.titleKey} className="relative flex flex-col items-center px-3 text-center">
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
              <p className="mt-4 font-semibold text-[#1a2744] dark:text-foreground">{t(step.titleKey)}</p>
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
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{text}</p>
}
