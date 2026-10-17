import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  CircleCheck,
  Home,
  Layers,
  Lock,
  MessageSquareQuote,
  Search,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'

import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/common/PageStates'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { marketplaceApi } from '@/features/marketplace/api/marketplace-api'
import { ListingCard, ListingGrid } from '@/features/marketplace/components/ListingCard'
import { StarRating } from '@/features/reviews/components/StarRating'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

import { homeApi } from '../api/home-api'
import { HouseCarousel } from '../components/HouseCarousel'
import { RotatingLogo } from '../components/RotatingLogo'
import type { HomeServiceReview } from '../types'

/** The four main features, each linking to its existing page. */
const featureCards: { icon: LucideIcon; to: string; titleKey: string; bodyKey: string; tone: string; iconTone: string }[] = [
  { icon: Home, to: '/finding-house', titleKey: 'home.feature.homeTitle', bodyKey: 'home.feature.homeBody', tone: 'bg-info-soft', iconTone: 'bg-primary text-primary-foreground' },
  { icon: Users, to: '/finding-roommates', titleKey: 'home.feature.roommatesTitle', bodyKey: 'home.feature.roommatesBody', tone: 'bg-pink-50 dark:bg-pink-950/30', iconTone: 'bg-pink-500 text-white' },
  { icon: Truck, to: '/hire-moving', titleKey: 'home.feature.movingTitle', bodyKey: 'home.feature.movingBody', tone: 'bg-cta-soft', iconTone: 'bg-cta text-cta-foreground' },
  { icon: Store, to: '/marketplace', titleKey: 'home.feature.marketTitle', bodyKey: 'home.feature.marketBody', tone: 'bg-success-soft', iconTone: 'bg-success text-white' },
]

const howItWorksSteps: { icon: LucideIcon; tile: string; titleKey: string; bodyKey: string; to?: string }[] = [
  { icon: Search, tile: 'from-sky-400 to-blue-600', titleKey: 'home.steps.homeTitle', bodyKey: 'home.steps.homeBody', to: '/finding-house' },
  { icon: Users, tile: 'from-pink-400 to-rose-500', titleKey: 'home.steps.roommatesTitle', bodyKey: 'home.steps.roommatesBody', to: '/finding-roommates' },
  { icon: Truck, tile: 'from-amber-400 to-yellow-500', titleKey: 'home.steps.moveTitle', bodyKey: 'home.steps.moveBody', to: '/hire-moving' },
  { icon: Store, tile: 'from-emerald-400 to-teal-500', titleKey: 'home.steps.marketTitle', bodyKey: 'home.steps.marketBody', to: '/marketplace' },
  { icon: Bell, tile: 'from-violet-500 to-purple-600', titleKey: 'home.steps.settleTitle', bodyKey: 'home.steps.settleBody' },
]

/** Services overview inside "Services & Customer Reviews"; same routes as the feature cards. */
const services: { icon: LucideIcon; to: string; titleKey: string; bodyKey: string }[] = [
  { icon: Home, to: '/finding-house', titleKey: 'home.services.housingTitle', bodyKey: 'home.services.housingBody' },
  { icon: Users, to: '/finding-roommates', titleKey: 'home.services.roommatesTitle', bodyKey: 'home.services.roommatesBody' },
  { icon: Truck, to: '/hire-moving', titleKey: 'home.services.movingTitle', bodyKey: 'home.services.movingBody' },
  { icon: Store, to: '/marketplace', titleKey: 'home.services.marketTitle', bodyKey: 'home.services.marketBody' },
]

const newPlaceItems: { icon: LucideIcon; titleKey: string; bodyKey: string }[] = [
  { icon: Home, titleKey: 'home.newPlaceItem1Title', bodyKey: 'home.newPlaceItem1Body' },
  { icon: CircleCheck, titleKey: 'home.newPlaceItem2Title', bodyKey: 'home.newPlaceItem2Body' },
  { icon: Store, titleKey: 'home.newPlaceItemMarketTitle', bodyKey: 'home.newPlaceItemMarketBody' },
  { icon: Banknote, titleKey: 'home.newPlaceItem3Title', bodyKey: 'home.newPlaceItem3Body' },
  { icon: Lock, titleKey: 'home.newPlaceItem4Title', bodyKey: 'home.newPlaceItem4Body' },
]

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function HomePage() {
  const { t } = useTranslation()

  const homeQuery = useQuery({ queryKey: ['home'], queryFn: () => homeApi.getContent() })
  const marketQuery = useQuery({ queryKey: ['marketplace', 'home'], queryFn: () => marketplaceApi.home() })

  const data = homeQuery.data
  // The hero shows a real listing photo when one exists; otherwise the brand panel.
  const heroPhoto = resolvePublicUploadUrl(
    data?.popularRecommended.find((house) => house.thumbnail)?.thumbnail ?? data?.featuredHouses.find((house) => house.thumbnail)?.thumbnail ?? null,
  )

  return (
    <div className="space-y-14">
      <Hero photo={heroPhoto} hasVerifiedAgents={Boolean(data?.verifiedAgents.some((agent) => agent.hasVerifiedBadge))} hasPartners={Boolean(data?.partnerMovingServices.length)} />

      <FeatureCards />

      {homeQuery.isLoading ? (
        <HomeSection title={t('home.popularTitle')} subtitle={t('home.popularSubtitle')}>
          <CardGridSkeleton
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*:nth-child(n+2)]:hidden sm:[&>*:nth-child(2)]:flex lg:[&>*:nth-child(3)]:flex"
            withControls
          />
        </HomeSection>
      ) : null}
      {homeQuery.isError ? <ErrorState message={t('home.loadError')} onRetry={() => void homeQuery.refetch()} /> : null}

      {data ? (
        <HomeSection
          title={t('home.popularTitle')}
          subtitle={t('home.popularSubtitle')}
          action={
            <Link to="/finding-house" className={cn('inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline', focusRing)}>
              {t('home.viewAllHouses')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        >
          {data.popularRecommended.length === 0 ? (
            <EmptyState text={t('home.emptyPopular')} />
          ) : (
            <HouseCarousel houses={data.popularRecommended} label={t('home.popularTitle')} />
          )}
        </HomeSection>
      ) : null}

      <CtaBanner />

      <HowShaweMalWorks />

      {data ? (
        <>
          <HomeSection title={t('home.agentsTitle')} subtitle={t('home.agentsSubtitle')}>
            {data.verifiedAgents.length === 0 ? (
              <EmptyState text={t('home.emptyAgents')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.verifiedAgents.map((agent) => (
                  <Card key={agent.id} className="bg-info-soft/40">
                    <CardContent className="flex items-center gap-3 p-4">
                      <UserAvatar path={agent.profilePicturePath} name={agent.name} className="size-11" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{agent.name}</p>
                          {agent.hasVerifiedBadge ? (
                            <Badge tone="info">
                              <BadgeCheck aria-hidden />
                              {t('home.verifiedBadge')}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{agent.agentProfile?.city?.name ?? t('houses.locationUnknown')}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Link to="/agent-register" className={cn('inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline', focusRing)}>
              {t('home.becomeAgent')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </HomeSection>

          <HomeSection title={t('home.movingPartnersTitle')} subtitle={t('home.movingPartnersSubtitle')}>
            {data.partnerMovingServices.length === 0 ? (
              <EmptyState text={t('home.emptyMoving')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.partnerMovingServices.map((partner) => (
                  <Card key={partner.id} className="bg-cta-soft/50">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground">
                        <Truck className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{partner.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {partner.driverProfile?.companyName || partner.driverProfile?.vehicleType?.name || t('home.movingPartnerFallback')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Link to="/hire-moving" className={cn('inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline', focusRing)}>
              {t('home.planMove')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </HomeSection>
        </>
      ) : null}

      <HomeSection
        title={t('home.marketHighlightsTitle')}
        subtitle={t('home.marketHighlightsSubtitle')}
        action={
          <Link to="/marketplace" className={cn('inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline', focusRing)}>
            {t('home.viewMarketplace')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      >
        {marketQuery.isLoading ? <CardGridSkeleton className="grid grid-cols-2 gap-3 lg:grid-cols-4" /> : null}
        {marketQuery.isError ? <ErrorState message={t('marketplace.loadError')} onRetry={() => void marketQuery.refetch()} /> : null}
        {marketQuery.data ? (
          (marketQuery.data.recentlyListed ?? []).length === 0 ? (
            <EmptyState text={t('home.emptyMarket')} />
          ) : (
            <ListingGrid className="lg:grid-cols-4">
              {(marketQuery.data.recentlyListed ?? []).slice(0, 4).map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </ListingGrid>
          )
        ) : null}
      </HomeSection>

      {data && data.newsUpdates.length > 0 ? (
        <HomeSection title={t('home.newsTitle')}>
          <div className="grid gap-3 md:grid-cols-2">
            {data.newsUpdates.map((item) => (
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
        </HomeSection>
      ) : null}

      <YourNewPlaceSection />

      <ServicesAndReviews reviews={data?.serviceReviews ?? null} isLoading={homeQuery.isLoading} isError={homeQuery.isError} onRetry={() => void homeQuery.refetch()} />
    </div>
  )
}

function Hero({ photo, hasVerifiedAgents, hasPartners }: { photo: string | null; hasVerifiedAgents: boolean; hasPartners: boolean }) {
  const { t } = useTranslation()
  const [photoFailed, setPhotoFailed] = useState(false)
  // Only claims the platform can back: verification exists for agents, partners are listed when present.
  const trust: { icon: LucideIcon; key: string }[] = [
    ...(hasVerifiedAgents ? [{ icon: BadgeCheck, key: 'home.trust.verifiedAgents' }] : []),
    ...(hasPartners ? [{ icon: Truck, key: 'home.trust.partners' }] : []),
    { icon: Layers, key: 'home.trust.allInOne' },
  ]

  return (
    <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-brand-sky-soft via-background to-background shadow-card">
      <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-5">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{t('home.heroTitle')}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t('home.heroDescription')}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {trust.map(({ icon: Icon, key }) => (
              <li key={key} className="inline-flex items-center gap-1.5">
                <Icon className="size-4 text-primary" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          {photo && !photoFailed ? (
            <img
              src={photo}
              alt={t('home.heroPhotoAlt')}
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-surface-warm via-surface-warm-2 to-surface-warm-3 dark:from-muted dark:via-card dark:to-secondary">
              <div className="pointer-events-none absolute -right-10 top-6 size-56 rounded-full bg-primary/25 blur-3xl" />
              <RotatingLogo alt={t('home.newPlaceLogoAlt')} className="z-10" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function FeatureCards() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('home.featuresLabel')}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featureCards.map(({ icon: Icon, to, titleKey, bodyKey, tone, iconTone }) => (
          <li key={to}>
            <Link
              to={to}
              className={cn('group flex h-full flex-col gap-3 rounded-2xl border p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md', tone, focusRing)}
            >
              <span className={cn('flex size-11 items-center justify-center rounded-xl', iconTone)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-lg font-semibold">{t(titleKey)}</span>
              <span className="flex-1 text-sm text-muted-foreground">{t(bodyKey)}</span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {t('home.feature.go')}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function CtaBanner() {
  const { t } = useTranslation()
  return (
    <section className="rounded-3xl bg-header px-6 py-10 text-center text-header-foreground shadow-card sm:px-10" aria-labelledby="home-cta-title">
      <h2 id="home-cta-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
        {t('home.ctaTitle')}
      </h2>
      <p className="mt-2 text-header-foreground/80">{t('home.ctaBody')}</p>
      <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link to="/finding-house">
            <Home aria-hidden />
            {t('home.ctaFindHome')}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="cta">
          <Link to="/hire-moving">
            <Truck aria-hidden />
            {t('home.ctaPlanMove')}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function HowShaweMalWorks() {
  const { t } = useTranslation()
  return (
    <section className="space-y-8" aria-labelledby="how-it-works-title">
      <div className="text-center">
        <h2 id="how-it-works-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          <Trans i18nKey="home.howItWorksHeading" components={{ brand: <span className="text-primary" /> }} />
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t('home.howItWorksDescription')}</p>
      </div>
      <ol className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-6">
        {howItWorksSteps.map((step, index) => {
          const Icon = step.icon
          const isLast = index === howItWorksSteps.length - 1
          const title = (
            <>
              <span className="sr-only">{t('home.stepNumber', { number: index + 1 })} </span>
              {t(step.titleKey)}
            </>
          )
          return (
            <li key={step.titleKey} className="relative flex flex-col items-center px-2 text-center">
              {!isLast ? (
                <ArrowRight className="pointer-events-none absolute top-5 -right-4 hidden size-6 text-muted-foreground/60 lg:block" aria-hidden />
              ) : null}
              <span className={cn('relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md', step.tile)}>
                <Icon className="size-7 text-white" aria-hidden />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-background text-xs font-bold text-foreground" aria-hidden>
                  {index + 1}
                </span>
              </span>
              <p className="mt-4 font-semibold">
                {step.to ? (
                  <Link to={step.to} className={cn('rounded-sm underline-offset-4 hover:text-primary hover:underline', focusRing)}>
                    {title}
                  </Link>
                ) : (
                  title
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

function ReviewCard({ review }: { review: HomeServiceReview }) {
  const { t, i18n } = useTranslation()
  const category = review.targetType === 'DRIVER' ? 'moving' : review.targetType === 'AGENT' ? 'housing' : review.targetType === 'SELLER' ? 'marketplace' : null
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <StarRating value={review.rating} readOnly size="sm" />
          {category ? <Badge tone="neutral">{t(`home.reviewCategory.${category}`)}</Badge> : null}
        </div>
        <p className="flex-1 text-sm leading-relaxed">“{review.comment?.trim() || t('home.reviewNoComment')}”</p>
        <div className="flex items-center gap-2 border-t pt-3">
          <UserAvatar name={review.reviewer?.name ?? '?'} className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{review.reviewer?.name ?? t('home.anonymousReviewer')}</p>
            <p className="text-xs text-muted-foreground">
              {review.targetUser?.name ? t('home.reviewAbout', { name: review.targetUser.name }) : null}
              {review.targetUser?.name && review.createdAt ? ' · ' : null}
              {review.createdAt ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(review.createdAt)) : null}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ServicesAndReviews({
  reviews,
  isLoading,
  isError,
  onRetry,
}: {
  reviews: HomeServiceReview[] | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="space-y-8 rounded-3xl bg-muted/40 p-6 sm:p-10" aria-labelledby="services-reviews-title">
      <div className="text-center">
        <h2 id="services-reviews-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('home.servicesReviewsTitle')}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t('home.servicesReviewsDescription')}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map(({ icon: Icon, to, titleKey, bodyKey }) => (
          <li key={to}>
            <Link to={to} className={cn('group flex h-full flex-col gap-2 rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-md', focusRing)}>
              <Icon className="size-6 text-primary" aria-hidden />
              <span className="font-semibold">{t(titleKey)}</span>
              <span className="flex-1 text-sm text-muted-foreground">{t(bodyKey)}</span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {t('home.feature.go')}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="space-y-4" aria-labelledby="reviews-title">
        <h3 id="reviews-title" className="flex items-center gap-2 text-xl font-semibold">
          <MessageSquareQuote className="size-5 text-primary" aria-hidden />
          {t('home.reviewsHeading')}
        </h3>
        {isLoading ? <CardGridSkeleton className="grid gap-4 md:grid-cols-3" /> : null}
        {isError ? <ErrorState message={t('home.loadError')} onRetry={onRetry} /> : null}
        {reviews && reviews.length === 0 ? <EmptyState text={t('home.reviewsEmpty')} /> : null}
        {reviews && reviews.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

function YourNewPlaceSection() {
  const { t } = useTranslation()
  return (
    <section className="overflow-hidden rounded-2xl bg-surface-warm text-foreground dark:bg-muted">
      <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-12">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('home.newPlaceTitle')}</h2>
          <p className="text-muted-foreground">{t('home.newPlaceSubtitle')}</p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('home.newPlaceIntro')}</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
    </section>
  )
}

function HomeSection({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
