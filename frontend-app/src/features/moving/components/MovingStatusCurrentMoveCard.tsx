import { CalendarDays, Car, Clock, MapPin, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { vehicleLabel } from '../lib/moving-status'
import type { MovingRequest } from '../types'
import { MovingStatusBookingDetails } from './MovingStatusBookingDetails'

export function MovingStatusCurrentMoveCard({ request }: { request: MovingRequest }) {
  const { t } = useTranslation()
  const moveAt = request.moveInDate ? new Date(request.moveInDate) : null

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">{t('moving.statusBookingDetails')}</CardTitle>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          {t(`moving.statusBadge.${request.status}`, { defaultValue: request.status })}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          <span className="text-muted-foreground">{t('moving.orderNumber')}: </span>
          <span className="font-semibold text-primary">{request.orderNumber ?? request.id}</span>
        </p>
        <div className="space-y-3">
          <RouteRow tone="from" label={t('moving.pickupAddress')} value={request.pickupAddress} />
          <RouteRow tone="to" label={t('moving.dropoffAddress')} value={request.dropoffAddress} />
        </div>
        <dl className="grid gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-2">
          <Fact icon={CalendarDays} label={t('moving.moveInDate')}>
            {moveAt ? moveAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </Fact>
          <Fact icon={Clock} label={t('moving.moveInTime')}>
            {moveAt ? moveAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}
          </Fact>
          <Fact icon={Car} label={t('moving.vehicleType')}>
            {vehicleLabel(request)}
          </Fact>
          <Fact icon={Wallet} label={t('moving.totalPrice')}>
            <span className="text-primary">
              {typeof request.estimatedPrice === 'number' ? `${request.estimatedPrice.toLocaleString()} MMK` : '—'}
            </span>
          </Fact>
        </dl>
        <MovingStatusBookingDetails request={request} />
      </CardContent>
    </Card>
  )
}

function Fact({ icon: Icon, label, children }: { icon: typeof Car; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words font-semibold">{children}</dd>
      </div>
    </div>
  )
}

function RouteRow({ tone, label, value }: { tone: 'from' | 'to'; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      {tone === 'from' ? (
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      ) : (
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words font-semibold">{value}</p>
      </div>
    </div>
  )
}
