import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { ADMIN_MASTER_DATA_ENTITIES } from '../constants/master-data-entities'

export function AdminMasterDataPage() {
  const { t } = useTranslation()

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.masterData.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.masterData.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_MASTER_DATA_ENTITIES.map((entity) => (
          <Link key={entity} to={`/admin/master-data/${entity}`} className="group block">
            <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
              <CardHeader>
                <CardTitle className="text-base">{t(`admin.masterData.entities.${entity}`)}</CardTitle>
                <CardDescription>{entity}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('admin.masterData.openEntity')}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
