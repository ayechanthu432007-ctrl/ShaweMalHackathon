import { AlertTriangle } from 'lucide-react'
import { useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

/**
 * Shown instead of React Router's developer error screen when a page fails to render, or when a
 * page's code can no longer be downloaded (for example right after a new version is deployed).
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{t('common.errorTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('common.errorBody')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            {t('common.reload')}
          </Button>
          <Button asChild variant="outline">
            <a href="/">{t('common.notFoundHome')}</a>
          </Button>
        </div>
      </div>
    </main>
  )
}
