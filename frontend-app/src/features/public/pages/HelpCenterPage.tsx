import { CalendarCheck, ChevronDown, CircleHelp, House, Search, Store, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type HelpCategory = 'housing' | 'moving' | 'bookings' | 'marketplace'
type HelpTopic = 'all' | HelpCategory

const topics: { id: HelpTopic; icon?: typeof House }[] = [
  { id: 'all' },
  { id: 'housing', icon: House },
  { id: 'moving', icon: Truck },
  { id: 'bookings', icon: CalendarCheck },
  { id: 'marketplace', icon: Store },
]

const quickLinks: { category: HelpCategory; to: string; icon: typeof House; linkKey: string }[] = [
  { category: 'housing', to: '/finding-house', icon: House, linkKey: 'browseHomes' },
  { category: 'moving', to: '/hire-moving', icon: Truck, linkKey: 'requestMove' },
  { category: 'bookings', to: '/profile/bookings', icon: CalendarCheck, linkKey: 'myBookings' },
  { category: 'marketplace', to: '/marketplace', icon: Store, linkKey: 'browseMarketplace' },
]

const questions: { category: HelpCategory; key: string }[] = [
  { category: 'housing', key: 'search' },
  { category: 'housing', key: 'costs' },
  { category: 'housing', key: 'request' },
  { category: 'moving', key: 'request' },
  { category: 'moving', key: 'estimate' },
  { category: 'moving', key: 'track' },
  { category: 'bookings', key: 'find' },
  { category: 'bookings', key: 'status' },
  { category: 'bookings', key: 'cancel' },
  { category: 'marketplace', key: 'items' },
  { category: 'marketplace', key: 'sell' },
  { category: 'marketplace', key: 'contact' },
]

export function HelpCenterPage() {
  const { t } = useTranslation()
  const [activeTopic, setActiveTopic] = useState<HelpTopic>('all')
  const [searchText, setSearchText] = useState('')

  const visibleQuestions = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase()
    return questions.filter(({ category, key }) => {
      if (activeTopic !== 'all' && category !== activeTopic) return false
      if (!search) return true
      const question = t(`helpCenter.questions.${category}.${key}.question`).toLocaleLowerCase()
      const answer = t(`helpCenter.questions.${category}.${key}.answer`).toLocaleLowerCase()
      return question.includes(search) || answer.includes(search)
    })
  }, [activeTopic, searchText, t])

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-9">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-sm font-medium text-primary">
            <CircleHelp className="size-4" aria-hidden />
            {t('helpCenter.eyebrow')}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('helpCenter.title')}</h1>
            <p className="max-w-xl leading-relaxed text-muted-foreground">{t('helpCenter.subtitle')}</p>
          </div>
          <div className="max-w-xl space-y-2">
            <Label htmlFor="help-search" className="sr-only">{t('helpCenter.searchLabel')}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="help-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={t('helpCenter.searchPlaceholder')}
                className="h-12 bg-background pl-10"
              />
            </div>
          </div>
        </div>
        <CircleHelp className="absolute -right-6 -bottom-12 size-48 text-primary/[0.06] sm:size-64" aria-hidden />
      </header>

      <nav className="flex flex-wrap gap-2" aria-label={t('helpCenter.topicsLabel')}>
        {topics.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={activeTopic === id ? 'default' : 'outline'}
            aria-pressed={activeTopic === id}
            onClick={() => setActiveTopic(id)}
            className="gap-2 rounded-full"
          >
            {Icon ? <Icon className="size-4" aria-hidden /> : null}
            {t(`helpCenter.topics.${id}`)}
          </Button>
        ))}
      </nav>

      <div className="space-y-3">
        {visibleQuestions.map(({ category, key }) => (
          <details key={`${category}-${key}`} className="group rounded-xl border bg-card shadow-card open:border-primary/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden sm:p-5">
              <span className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary" aria-hidden>
                  {category === 'housing' ? <House className="size-4" /> : null}
                  {category === 'moving' ? <Truck className="size-4" /> : null}
                  {category === 'bookings' ? <CalendarCheck className="size-4" /> : null}
                  {category === 'marketplace' ? <Store className="size-4" /> : null}
                </span>
                <span>{t(`helpCenter.questions.${category}.${key}.question`)}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t px-4 py-4 pl-14 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pl-[4.5rem]">
              {t(`helpCenter.questions.${category}.${key}.answer`)}
            </div>
          </details>
        ))}
        {visibleQuestions.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 py-10 text-center">
              <h2 className="font-semibold">{t('helpCenter.noResultsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('helpCenter.noResultsBody')}</p>
              <Button type="button" variant="outline" onClick={() => { setSearchText(''); setActiveTopic('all') }}>
                {t('helpCenter.reset')}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('helpCenter.shortcutsTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('helpCenter.shortcutsSubtitle')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map(({ category, to, icon: Icon, linkKey }) => (
            <Link key={category} to={to} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <CardTitle className="text-base">{t(`helpCenter.topics.${category}`)}</CardTitle>
                    <span className="mt-1 block text-sm font-normal text-muted-foreground">{t(`helpCenter.links.${linkKey}`)}</span>
                  </span>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
