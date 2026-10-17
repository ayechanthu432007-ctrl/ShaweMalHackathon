import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { CoverImage } from '@/components/common/CoverImage'
import { Card, CardContent } from '@/components/ui/card'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { formatDate } from '../lib/marketplace-format'
import type { MovingOutSaleSummary } from '../types'

export function MovingOutSaleCard({ sale }: { sale: MovingOutSaleSummary }) {
  const { t } = useTranslation()
  return (
    <Link to={`/marketplace/moving-out-sales/${sale.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="grid h-28 grid-cols-4 gap-0.5 bg-muted">
          {Array.from({ length: 4 }, (_, index) => {
            const src = resolvePublicUploadUrl(sale.previewImages[index])
            return src ? <CoverImage key={index} src={src} alt="" /> : <div key={index} className="bg-muted" />
          })}
        </div>
        <CardContent className="space-y-1 p-3">
          <p className="line-clamp-1 font-semibold">{sale.title}</p>
          <p className="text-xs text-muted-foreground">
            {sale.destinationCity
              ? t('marketplace.movingOut.route', { from: sale.originCity.name, to: sale.destinationCity.name })
              : t('marketplace.movingOut.from', { from: sale.originCity.name })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('marketplace.movingOut.itemCount', { count: sale.activeListingCount })}
            {sale.moveOutDate ? ` · ${t('marketplace.movingOut.leaving', { date: formatDate(sale.moveOutDate) })}` : ''}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
