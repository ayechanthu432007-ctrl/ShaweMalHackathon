import { ArrowUpRight, House, Store, Truck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const GUIDE_SEEN_KEY = 'shawe-mal:first-visit-guide-seen'

const steps = [
  { key: 'housing', to: '/finding-house', icon: House },
  { key: 'moving', to: '/hire-moving', icon: Truck },
  { key: 'marketplace', to: '/marketplace', icon: Store },
] as const

export function FirstVisitGuide() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    try {
      setIsVisible(window.localStorage.getItem(GUIDE_SEEN_KEY) !== 'yes')
    } catch {
      setIsVisible(true)
    }
  }, [])

  const dismiss = () => {
    try {
      window.localStorage.setItem(GUIDE_SEEN_KEY, 'yes')
    } catch {
      // Keep the guide dismissible if the browser does not allow saved settings.
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <section className="mb-8" aria-labelledby="first-visit-guide-title">
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-raised">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">{t('firstVisitGuide.eyebrow')}</p>
          <CardTitle id="first-visit-guide-title" className="text-xl sm:text-2xl">{t('firstVisitGuide.title')}</CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('firstVisitGuide.subtitle')}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 shrink-0"
          aria-label={t('firstVisitGuide.close')}
          onClick={dismiss}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 pt-0 sm:grid-cols-3 sm:p-6 sm:pt-0">
        {steps.map(({ key, to, icon: Icon }, index) => (
          <div key={key} className="flex h-full flex-col rounded-xl border bg-background/80 p-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('firstVisitGuide.step', { count: index + 1 })}
            </p>
            <h2 className="mt-1 font-semibold">{t(`firstVisitGuide.steps.${key}.title`)}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
              {t(`firstVisitGuide.steps.${key}.body`)}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full justify-between">
              <Link to={to} onClick={dismiss}>
                {t(`firstVisitGuide.steps.${key}.action`)}
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        ))}
        <div className="sm:col-span-3 sm:flex sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            {t('firstVisitGuide.dismiss')}
          </Button>
        </div>
      </CardContent>
    </Card>
    </section>
  )
}
