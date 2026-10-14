import { Car, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  assignedDriverName,
  assignedLicensePlate,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'

/**
 * The driver facts of a booking, shown as the last group of the Booking Details card.
 * Vehicle, price, date and addresses are in the groups above, so they are not repeated here.
 */
export function MovingStatusBookingDetails({ request }: { request: MovingRequest }) {
  const { t } = useTranslation()
  const driverName = assignedDriverName(request)
  const plate = assignedLicensePlate(request)

  // Items, points, max load and the driver's phone stay in the booking record; they are just not listed here.
  const rows = [
    { icon: User, label: t('moving.statusDriverName'), value: driverName ?? '—' },
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
