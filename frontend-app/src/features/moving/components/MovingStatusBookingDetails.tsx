import { Car, Hash, Package, Phone, Scale, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  assignedDriverName,
  assignedDriverPhone,
  assignedLicensePlate,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'

/**
 * The items and driver facts of a booking, shown as the last group of the Booking Details card.
 * Vehicle, price, date and addresses are in the groups above, so they are not repeated here.
 */
export function MovingStatusBookingDetails({ request }: { request: MovingRequest }) {
  const { t } = useTranslation()
  const driverName = assignedDriverName(request)
  const phone = assignedDriverPhone(request)
  const plate = assignedLicensePlate(request)
  const points =
    typeof request.totalInventoryPoints === 'number' ? `${request.totalInventoryPoints} pts` : '—'
  const itemCount = request.inventoryItems.reduce((sum, item) => sum + item.count, 0)

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
    <dl className="grid gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-2.5">
          <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="break-words font-semibold">{row.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
