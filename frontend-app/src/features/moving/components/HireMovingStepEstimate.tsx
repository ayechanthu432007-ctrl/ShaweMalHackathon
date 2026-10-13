import { useTranslation } from 'react-i18next'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MasterDataItem } from '@/features/master-data/types'

import type { MovingRequestFormValues } from '../schemas/moving-request-schema'
import type { MovingQuote } from '../types'
import { HireMovingField } from './HireMovingField'
import { HireMovingStepNav } from './HireMovingStepNav'

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('moving.estimateTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('moving.estimateHint')}</p>
      </div>

      {isQuoting && !quote ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

      {quote ? (
        <div className="space-y-3 rounded-md border p-4 text-sm">
          <p>
            <span className="font-medium">{t('moving.suggestedVehicle')}: </span>
            {quote.suggestedVehicleType.name}
            {quote.suggestedVehicleType.match === 'closest' ? ` (${t('moving.closestMatch')})` : ''}
          </p>
          <p>
            <span className="font-medium">{t('moving.totalPoints')}: </span>
            {quote.totalInventoryPoints}
          </p>
          <p>
            <span className="font-medium">{t('moving.distance')}: </span>
            {quote.distanceKm} km
          </p>
          <p>
            <span className="font-medium">{t('moving.pickupFloorSurcharge')}: </span>
            {formatMmk(quote.pickupFloorSurcharge)}
          </p>
          <p>
            <span className="font-medium">{t('moving.dropoffFloorSurcharge')}: </span>
            {formatMmk(quote.dropoffFloorSurcharge)}
          </p>
          <p>
            <span className="font-medium">{t('moving.pricePerKm')}: </span>
            {formatMmk(quote.pricePerKm)}
          </p>
          <p className="text-base font-semibold">
            {t('moving.estimatedPrice')}: {formatMmk(quote.estimatedPrice)}
          </p>
        </div>
      ) : null}

      <HireMovingField label={t('moving.vehicleType')}>
        <select
          className={selectClassName}
          value={vehicleTypeId}
          onChange={(event) => onVehicleChange(event.target.value)}
        >
          {(vehicles.length > 0 ? vehicles : []).map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name}
            </option>
          ))}
        </select>
      </HireMovingField>

      <HireMovingField label={t('moving.moveInDate')} error={errors.moveInDate?.message} className="max-w-xs">
        <Input type="date" {...register('moveInDate')} />
      </HireMovingField>

      <HireMovingStepNav onBack={onBack}>
        <Button type="submit" disabled={isSubmitting || isQuoting || !quote}>
          {isSubmitting ? t('common.loading') : t('moving.confirmBooking')}
        </Button>
      </HireMovingStepNav>
    </div>
  )
}
