import { Check, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MovingStatusSafetyCard() {
  const { t } = useTranslation()
  const items = [
    t('moving.statusSafetyVerified'),
    t('moving.statusSafetyBackground'),
    t('moving.statusSafetyInsurance'),
  ]

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('moving.statusSafetyTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
