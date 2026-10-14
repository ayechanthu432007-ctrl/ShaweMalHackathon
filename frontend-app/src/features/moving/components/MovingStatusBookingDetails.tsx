import { Car, Hash, Package, Phone, Scale, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {
  assignedDriverName,
  assignedDriverPhone,
  assignedLicensePlate,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'

export function MovingStatusBookingDetails({ request }: { request: MovingRequest }) {
  const { t } = useTranslation()
  const driverName = assignedDriverName(request)
  const phone = assignedDriverPhone(request)
  const plate = assignedLicensePlate(request)
  const points =
    typeof request.totalInventoryPoints === 'number' ? `${request.totalInventoryPoints} pts` : '—'
  const itemCount = request.inventoryItems.reduce((sum, item) => sum + item.count, 0)

  // Vehicle, price, date and addresses are on the Current Move card above, so they are not repeated.
  const rows = [
    { icon: Package, label: t('moving.selectedItems'), value: itemCount > 0 ? t('moving.itemCount', { count: itemCount }) : '—' },
    { icon: Hash, label: t('moving.statusItemsVolume'), value: points },
    ...(typeof request.vehicleType?.maxLoadKg === 'number'
      ? [{ icon: Scale, label: t('moving.vehicleMaxLoad'), value: `${request.vehicleType.maxLoadKg.toLocaleString()} kg` }]
      : []),
    { icon: User, label: t('moving.statusDriverName'), value: driverName ?? '—' },
    { icon: Phone, label: t('moving.bookerPhone'), value: phone ?? '—' },
    { icon: Car, label: t('moving.statusLicensePlate'), value: plate ?? '—' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('moving.statusBookingDetails')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 text-sm">
            <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-muted-foreground">{row.label}</p>
              <p className="break-words font-semibold">{row.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
