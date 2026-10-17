import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AboutUsPage() {
  const { t } = useTranslation()

  const pillars = [
    { title: t('public.aboutPillarHousingTitle'), body: t('public.aboutPillarHousingBody') },
    { title: t('public.aboutPillarMovingTitle'), body: t('public.aboutPillarMovingBody') },
    { title: t('public.aboutPillarRoommatesTitle'), body: t('public.aboutPillarRoommatesBody') },
  ]

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('public.aboutTitle')}</h1>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
          {t('public.aboutIntro')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {pillars.map((pillar) => (
          <Card key={pillar.title} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{pillar.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/30 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('public.aboutTrustTitle')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t('public.aboutTrustBody')}
        </p>
      </div>
    </section>
  )
}
