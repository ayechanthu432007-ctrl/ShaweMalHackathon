import { Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MasterDataItem } from '@/features/master-data/types'

import { todayDateInputValue, type MovingRequestFormValues } from '../schemas/moving-request-schema'
import type { MovingQuote } from '../types'
import { HireMovingField } from './HireMovingField'
import { HireMovingStepNav } from './HireMovingStepNav'
import { inventoryItemIcon } from './InventoryItemRow'

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function formatMmk(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString()} MMK`
}

export function HireMovingStepEstimate({
  quote,
  vehicles,
  vehicleTypeId,
  onVehicleChange,
  register,
  errors,
  isQuoting,
  isSubmitting,
  onBack,
}: {
  quote: MovingQuote | null
  vehicles: MasterDataItem[]
  vehicleTypeId: string
  onVehicleChange: (vehicleTypeId: string) => void
  register: UseFormRegister<MovingRequestFormValues>
  errors: FieldErrors<MovingRequestFormValues>
  isQuoting: boolean
  isSubmitting: boolean
  onBack: () => void
}) {
  const { t } = useTranslation()

  const selected = quote?.selectedVehicleType
  const suggested = quote?.suggestedVehicleType
  const usesSuggested = Boolean(selected && suggested && selected.id === suggested.id)
  const itemCount = quote ? quote.inventoryItems.reduce((sum, item) => sum + item.count, 0) : 0
  // The same sum the server makes: rate of the chosen vehicle times the distance.
  const distanceFee = quote ? Math.round(quote.pricePerKm * quote.distanceKm * 100) / 100 : null

  const cardClassName = 'rounded-xl border bg-card p-4 shadow-sm sm:p-5'
  const cardTitleClassName = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('moving.estimateTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('moving.estimateHint')}</p>
      </div>

      {isQuoting && !quote ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

      {quote && selected && suggested ? (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
            {/* ---------- vehicle ---------- */}
            <section className={cardClassName} aria-labelledby="moving-vehicle-title">
              <h3 id="moving-vehicle-title" className={cardTitleClassName}>
                {usesSuggested ? t('moving.suggestedVehicle') : t('moving.selectedVehicle')}
              </h3>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Truck className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight">{selected.name}</p>
                  {usesSuggested && suggested.match === 'closest' ? <p className="text-xs text-muted-foreground">{t('moving.closestMatch')}</p> : null}
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                {selected.capacityLabel ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t('moving.vehicleCapacity')}</dt>
                    <dd className="font-medium">{selected.capacityLabel}</dd>
                  </div>
                ) : null}
                {typeof selected.maxLoadKg === 'number' ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t('moving.vehicleMaxLoad')}</dt>
                    <dd className="font-medium">{selected.maxLoadKg.toLocaleString()} kg</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('moving.pricePerKm')}</dt>
                  <dd className="font-medium">{formatMmk(quote.pricePerKm)}</dd>
                </div>
              </dl>
              {!usesSuggested ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('moving.suggestedVehicle')}: <span className="font-medium text-foreground">{suggested.name}</span>
                </p>
              ) : null}
              <HireMovingField label={t('moving.chooseVehicle')} className="mt-4">
                <select className={selectClassName} value={vehicleTypeId} disabled={isQuoting} onChange={(event) => onVehicleChange(event.target.value)}>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
              </HireMovingField>
            </section>

            {/* ---------- selected items ---------- */}
            <section className={cardClassName} aria-labelledby="moving-items-title">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="moving-items-title" className={cardTitleClassName}>
                  {t('moving.selectedItems')}
                </h3>
                <p className="text-sm text-muted-foreground">{t('moving.itemCount', { count: itemCount })}</p>
              </div>
              <ul className="mt-3 max-h-72 divide-y overflow-y-auto pr-1">
                {quote.inventoryItems.map((item) => (
                  <li key={item.inventoryItemTypeId ?? item.itemName} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg" aria-hidden>
                      {inventoryItemIcon({ code: '', itemName: item.itemName, category: item.category })}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.itemName}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">× {item.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ---------- price breakdown ---------- */}
          <section className={cardClassName} aria-labelledby="moving-price-title">
            <h3 id="moving-price-title" className={cardTitleClassName}>
              {t('moving.priceBreakdown')}
            </h3>
            <dl className="mt-3 divide-y text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <dt>
                  <span className="font-medium">{t('moving.distanceFee')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t('moving.distanceFeeDetail', { distance: quote.distanceKm, rate: formatMmk(quote.pricePerKm), vehicle: selected.name })}
                  </span>
                </dt>
                <dd className="font-medium tabular-nums">{formatMmk(distanceFee)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <dt>
                  <span className="font-medium">{t('moving.pickupFloorSurcharge')}</span>
                  <span className="block text-xs text-muted-foreground">{quote.pickupFloorLevel.name}</span>
                </dt>
                <dd className="font-medium tabular-nums">{formatMmk(quote.pickupFloorSurcharge)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <dt>
                  <span className="font-medium">{t('moving.dropoffFloorSurcharge')}</span>
                  <span className="block text-xs text-muted-foreground">{quote.dropoffFloorLevel.name}</span>
                </dt>
                <dd className="font-medium tabular-nums">{formatMmk(quote.dropoffFloorSurcharge)}</dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg bg-primary/10 px-4 py-3">
              <p className="text-base font-semibold">{t('moving.estimatedTotal')}</p>
              <p className={`text-2xl font-bold tabular-nums text-primary ${isQuoting ? 'opacity-50' : ''}`} aria-live="polite">
                {formatMmk(quote.estimatedPrice)}
              </p>
            </div>
          </section>
        </>
      ) : null}

      <HireMovingField label={t('moving.moveInDate')} error={errors.moveInDate?.message} className="max-w-xs">
        <Input type="date" min={todayDateInputValue()} required {...register('moveInDate')} />
      </HireMovingField>

      <HireMovingStepNav onBack={onBack}>
        <Button type="submit" disabled={isSubmitting || isQuoting || !quote}>
          {isSubmitting ? t('common.loading') : t('moving.confirmBooking')}
        </Button>
      </HireMovingStepNav>
    </div>
  )
}
