import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

/** Shown for any address that matches no route, inside the normal site layout. */
export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">{t('common.notFoundTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('common.notFoundBody')}</p>
      <Button asChild>
        <Link to="/">{t('common.notFoundHome')}</Link>
      </Button>
    </div>
  )
}
