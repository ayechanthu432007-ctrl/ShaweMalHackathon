import { CircleCheck, CircleX, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ALLOWED_KEYS = ['furniture', 'electronics', 'appliances', 'study', 'household', 'bags', 'books', 'other'] as const
const PROHIBITED_KEYS = ['weapons', 'drugs', 'stolen', 'counterfeit', 'wildlife', 'medicine', 'adult', 'documents'] as const
const RULE_KEYS = ['honest', 'photos', 'contact', 'sold', 'payment'] as const

export function MarketplacePolicyPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton fallback="/marketplace" />
      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <ShieldCheck className="size-4" aria-hidden />
          {t('marketplace.policy.eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('marketplace.policy.title')}</h1>
        <p className="text-muted-foreground">{t('marketplace.policy.intro')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CircleCheck className="size-5 text-emerald-600" aria-hidden />
              {t('marketplace.policy.allowedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ALLOWED_KEYS.map((key) => (
                <li key={key}>{t(`marketplace.policy.allowed.${key}`)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CircleX className="size-5 text-destructive" aria-hidden />
              {t('marketplace.policy.prohibitedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {PROHIBITED_KEYS.map((key) => (
                <li key={key}>{t(`marketplace.policy.prohibited.${key}`)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('marketplace.policy.rulesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {RULE_KEYS.map((key) => (
              <li key={key}>{t(`marketplace.policy.rules.${key}`)}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('marketplace.policy.moderationTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('marketplace.policy.moderationBody')}</p>
          <p>{t('marketplace.policy.privacyBody')}</p>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/marketplace">{t('marketplace.backToMarketplace')}</Link>
      </Button>
    </div>
  )
}
