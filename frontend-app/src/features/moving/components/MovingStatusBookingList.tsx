import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

import { completionDate, isActiveMovingStatus } from '../lib/moving-status'
import type { MovingRequest } from '../types'

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

export function MovingStatusBookingList({ items }: { items: MovingRequest[] }) {
  const { t } = useTranslation()
  const active = items.filter((item) => isActiveMovingStatus(item.status))
  const completed = items.filter((item) => item.status === 'COMPLETED')
  // Cancelled bookings are neither in progress nor completed, so they keep their own list underneath.
  const other = items.filter((item) => !isActiveMovingStatus(item.status) && item.status !== 'COMPLETED')

  return (
    <section className="space-y-8" aria-label={t('moving.statusBookingsLabel')}>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Column title={t('moving.statusActiveGroup')} count={active.length} empty={t('moving.statusNoActive')}>
          {active.map((item) => (
            <BookingCard key={item.id} item={item}>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`moving.statusBadge.${item.status}`, { defaultValue: item.status })}
                {item.moveInDate ? ` · ${formatDate(item.moveInDate)}` : null}
              </p>
              <Button asChild className="mt-4 w-fit" size="sm">
                <Link to={`/moving-status/${item.id}`}>{t('moving.statusCheckStatus')}</Link>
              </Button>
            </BookingCard>
          ))}
        </Column>

        <Column title={t('moving.statusCompletedGroup')} count={completed.length} empty={t('moving.statusNoCompleted')}>
          {completed.map((item) => {
            const doneAt = formatDate(completionDate(item))
            return (
              <BookingCard key={item.id} item={item} badge={<CompletedBadge />}>
                {doneAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('moving.receiptCompletedOn')} {doneAt}
                  </p>
                ) : null}
                <Button asChild className="mt-4 w-fit" size="sm" variant="outline">
                  <Link to={`/moving-status/${item.id}/receipt`}>{t('moving.viewReceipt')}</Link>
                </Button>
              </BookingCard>
            )
          })}
        </Column>
      </div>

      {other.length > 0 ? (
        <Column title={t('moving.statusPastGroup')} count={other.length}>
          <div className="grid gap-3 sm:grid-cols-2">
            {other.map((item) => (
              <BookingCard key={item.id} item={item}>
                <p className="mt-1 text-xs text-muted-foreground">{t(`moving.statusBadge.${item.status}`, { defaultValue: item.status })}</p>
                <Button asChild className="mt-4 w-fit" size="sm" variant="outline">
                  <Link to={`/moving-status/${item.id}`}>{t('moving.statusCheckStatus')}</Link>
                </Button>
              </BookingCard>
            ))}
          </div>
        </Column>
      ) : null}
    </section>
  )
}

function Column({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
      </h2>
      {count === 0 && empty ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="space-y-3">{children}</ul>
    </div>
  )
}

function BookingCard({ item, badge, children }: { item: MovingRequest; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <article className="flex h-full flex-col rounded-xl border bg-card p-4 text-sm shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-primary">{item.orderNumber ?? item.id}</p>
          {badge}
        </div>
        <p className="mt-1 break-words text-muted-foreground">
          {item.pickupAddress} → {item.dropoffAddress}
        </p>
        {children}
      </article>
    </li>
  )
}

function CompletedBadge() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <CheckCircle2 className="size-3.5" aria-hidden />
      {t('moving.receiptCompleted')}
    </span>
  )
}
