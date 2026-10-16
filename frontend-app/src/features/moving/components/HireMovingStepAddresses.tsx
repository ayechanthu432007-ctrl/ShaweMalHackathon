import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import typesOfCar from '@/assets/typesofcar.jpg'
import { geocodeNominatim } from '@/features/houses/lib/geocode-location'
import type { MasterDataItem } from '@/features/master-data/types'

import { composeMovingAddress } from '../lib/moving-location'
import type { MovingRequestFormValues } from '../schemas/moving-request-schema'
import { HireMovingEasySteps } from './HireMovingEasySteps'
import { MOVING_FORWARD_BUTTON_CLASS } from './HireMovingStepNav'
import { HireMovingField } from './HireMovingField'
import { MovingRouteMap, type MovingPinRole } from './MovingRouteMap'

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function AddressBlock({
  streetName,
  townshipName,
  register,
  errors,
  townships,
  t,
}: {
  streetName: 'pickupStreet' | 'dropoffStreet'
  townshipName: 'pickupTownship' | 'dropoffTownship'
  register: UseFormRegister<MovingRequestFormValues>
  errors: FieldErrors<MovingRequestFormValues>
  townships: MasterDataItem[]
  t: (key: string) => string
}) {
  const isPickup = streetName === 'pickupStreet'
  const listId = isPickup ? 'yangon-townships-pickup' : 'yangon-townships-dropoff'

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <HireMovingField
        label={isPickup ? t('moving.pickupTownship') : t('moving.dropoffTownship')}
        error={errors[townshipName]?.message}
      >
        <Input list={listId} autoComplete="off" {...register(townshipName)} />
        <datalist id={listId}>
          {townships.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </HireMovingField>
      <HireMovingField
        label={isPickup ? t('moving.pickupStreet') : t('moving.dropoffStreet')}
        error={errors[streetName]?.message}
      >
        <Input {...register(streetName)} placeholder={t('moving.streetPlaceholder')} />
      </HireMovingField>
    </div>
  )
}

export function HireMovingStepAddresses({
  register,
  errors,
  watch,
  setValue,
  townships,
}: {
  register: UseFormRegister<MovingRequestFormValues>
  errors: FieldErrors<MovingRequestFormValues>
  watch: UseFormWatch<MovingRequestFormValues>
  setValue: UseFormSetValue<MovingRequestFormValues>
  townships: MasterDataItem[]
}) {
  const { t } = useTranslation()
  const [pinTarget, setPinTarget] = useState<MovingPinRole>('pickup')
  const pickupManualPin = useRef(false)
  const dropoffManualPin = useRef(false)
  const lastPickupTownship = useRef('')
  const lastDropoffTownship = useRef('')

  const pickupStreet = watch('pickupStreet')
  const dropoffStreet = watch('dropoffStreet')
  const pickupTownship = watch('pickupTownship')
  const dropoffTownship = watch('dropoffTownship')
  const pickupLatitude = watch('pickupLatitude')
  const pickupLongitude = watch('pickupLongitude')
  const dropoffLatitude = watch('dropoffLatitude')
  const dropoffLongitude = watch('dropoffLongitude')

  useEffect(() => {
    setValue('pickupAddress', composeMovingAddress(pickupStreet, pickupTownship), {
      shouldDirty: true,
    })
  }, [pickupStreet, pickupTownship, setValue])

  useEffect(() => {
    setValue('dropoffAddress', composeMovingAddress(dropoffStreet, dropoffTownship), {
      shouldDirty: true,
    })
  }, [dropoffStreet, dropoffTownship, setValue])

  useEffect(() => {
    const township = pickupTownship.trim()
    if (!township) return
    if (township === lastPickupTownship.current && pickupManualPin.current) return
    lastPickupTownship.current = township
    pickupManualPin.current = false

    let cancelled = false
    const timer = window.setTimeout(() => {
      void geocodeNominatim(composeMovingAddress('', township)).then((result) => {
        if (cancelled || !result || pickupManualPin.current) return
        setValue('pickupLatitude', String(result.lat), { shouldDirty: true, shouldTouch: true })
        setValue('pickupLongitude', String(result.lng), { shouldDirty: true, shouldTouch: true })
      })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pickupTownship, setValue])

  useEffect(() => {
    const township = dropoffTownship.trim()
    if (!township) return
    if (township === lastDropoffTownship.current && dropoffManualPin.current) return
    lastDropoffTownship.current = township
    dropoffManualPin.current = false

    let cancelled = false
    const timer = window.setTimeout(() => {
      void geocodeNominatim(composeMovingAddress('', township)).then((result) => {
        if (cancelled || !result || dropoffManualPin.current) return
        setValue('dropoffLatitude', String(result.lat), { shouldDirty: true, shouldTouch: true })
        setValue('dropoffLongitude', String(result.lng), { shouldDirty: true, shouldTouch: true })
      })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [dropoffTownship, setValue])

  return (
    <div className="space-y-8">
      {/* Step 1's only forward button sits at the top right, so it is reachable without scrolling. */}
      <div className="flex justify-end">
        <Button
          type="submit"
          className={MOVING_FORWARD_BUTTON_CLASS}
        >
          {t('moving.continue')}
          <ArrowRight aria-hidden />
        </Button>
      </div>
      <div className="grid gap-6">
        <AddressBlock
          streetName="pickupStreet"
          townshipName="pickupTownship"
          register={register}
          errors={errors}
          townships={townships}
          t={t}
        />
        <AddressBlock
          streetName="dropoffStreet"
          townshipName="dropoffTownship"
          register={register}
          errors={errors}
          townships={townships}
          t={t}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">{t('moving.mapTitle')}</h2>
          <select
            className={`${selectClassName} w-auto min-w-48`}
            value={pinTarget}
            onChange={(event) => setPinTarget(event.target.value as MovingPinRole)}
            aria-label={t('moving.pinTarget')}
          >
            <option value="pickup">{t('moving.pinPickup')}</option>
            <option value="dropoff">{t('moving.pinDropoff')}</option>
          </select>
        </div>
        <p className="text-sm text-muted-foreground">{t('moving.mapHint')}</p>
        <MovingRouteMap
          pickupLatitude={pickupLatitude}
          pickupLongitude={pickupLongitude}
          dropoffLatitude={dropoffLatitude}
          dropoffLongitude={dropoffLongitude}
          pinTarget={pinTarget}
          onPinChange={(role, point) => {
            if (role === 'pickup') {
              pickupManualPin.current = true
              setValue('pickupLatitude', String(point.latitude), { shouldDirty: true, shouldTouch: true })
              setValue('pickupLongitude', String(point.longitude), { shouldDirty: true, shouldTouch: true })
              return
            }
            dropoffManualPin.current = true
            setValue('dropoffLatitude', String(point.latitude), { shouldDirty: true, shouldTouch: true })
            setValue('dropoffLongitude', String(point.longitude), { shouldDirty: true, shouldTouch: true })
          }}
        />
        {errors.pickupLatitude?.message || errors.dropoffLatitude?.message ? (
          <p className="text-sm text-destructive">
            {errors.pickupLatitude?.message ?? errors.dropoffLatitude?.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t('moving.composedPickup')}: {composeMovingAddress(pickupStreet, pickupTownship) || '—'}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('moving.composedDropoff')}: {composeMovingAddress(dropoffStreet, dropoffTownship) || '—'}
        </p>
      </section>

      <HireMovingEasySteps />

      <section className="space-y-3">
        <img
          src={typesOfCar}
          alt={t('moving.carTypesTitle')}
          className="w-full rounded-md border object-contain"
        />
      </section>

    </div>
  )
}
