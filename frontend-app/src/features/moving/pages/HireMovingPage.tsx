import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { parseCoordinatePair } from '@/features/houses/lib/geocode-location'
import { ApiRequestError } from '@/lib/api/client'

import { yangonTownships } from '../lib/moving-location'
import { movingApi } from '../api/moving-api'
import { HireMovingStepAddresses } from '../components/HireMovingStepAddresses'
import { HireMovingStepConfirmation } from '../components/HireMovingStepConfirmation'
import { HireMovingStepDetails } from '../components/HireMovingStepDetails'
import { HireMovingStepEstimate } from '../components/HireMovingStepEstimate'
import { HireMovingStepProgress } from '../components/HireMovingStepProgress'
import { emptyInventoryCounts, type InventoryCatalogItem } from '../constants/inventory-catalog'
import { isMovingDemoAccount, MOVING_DEMO_PRESET } from '../lib/moving-demo'
import {
  buildInventoryItems,
  collectPhotoPaths,
  sumInventoryCounts,
  validateMovingStep1,
  validateMovingStep2,
  validateMovingStep3,
  type MovingRequestFormValues,
} from '../schemas/moving-request-schema'
import type { MovingQuote, MovingRequest } from '../types'

function parseStep(value: string | null): 1 | 2 | 3 | 4 {
  const parsed = Number(value ?? '1')
  if (parsed === 2 || parsed === 3 || parsed === 4) return parsed
  return 1
}

export function HireMovingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [createdRequest, setCreatedRequest] = useState<MovingRequest | null>(null)
  const [quote, setQuote] = useState<MovingQuote | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)

  const bookingId = searchParams.get('bookingId') ?? undefined
  const houseId = searchParams.get('houseId') ?? undefined
  const step = parseStep(searchParams.get('step'))
  // The booking just made; kept in the address so a refresh shows the same confirmation.
  const confirmedRequestId = searchParams.get('request')

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', {
        replace: true,
        state: { from: `${location.pathname}${location.search}`, authPrompt: 'moving' },
      })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, location.search, navigate])

  const inventoryQuery = useQuery({
    queryKey: ['master-data', 'moving-inventory-items'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('moving-inventory-items'),
  })
  const floorsQuery = useQuery({
    queryKey: ['master-data', 'floor-levels'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('floor-levels'),
  })
  const vehiclesQuery = useQuery({
    queryKey: ['master-data', 'vehicle-types'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('vehicle-types'),
  })
  const citiesQuery = useQuery({
    queryKey: ['master-data', 'cities'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('cities'),
  })

  const townships = useMemo(
    () => yangonTownships(citiesQuery.data?.items ?? []),
    [citiesQuery.data?.items],
  )
  const townshipNames = useMemo(() => townships.map((item) => item.name), [townships])

  const catalog: InventoryCatalogItem[] = useMemo(() => {
    return (inventoryQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      code: item.code ?? item.id,
      category: item.category ?? 'other',
      itemName: item.itemName ?? item.name ?? item.id,
      points: Number(item.points ?? 0),
    }))
  }, [inventoryQuery.data?.items])

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<MovingRequestFormValues>({
    defaultValues: {
      pickupAddress: '',
      dropoffAddress: '',
      pickupStreet: '',
      dropoffStreet: '',
      pickupTownship: '',
      dropoffTownship: '',
      pickupLatitude: '',
      pickupLongitude: '',
      dropoffLatitude: '',
      dropoffLongitude: '',
      pickupFloorLevelId: '',
      dropoffFloorLevelId: '',
      moveInDate: '',
      vehicleTypeId: '',
      remarks: '',
      damageChecklist: '',
      photo1: '',
      photo2: '',
      photo3: '',
      photo4: '',
      photo5: '',
      totalInventoryItems: '0',
      inventoryCounts: {},
    },
  })

  useEffect(() => {
    if (catalog.length === 0) return
    const current = getValues('inventoryCounts')
    const next = { ...emptyInventoryCounts(catalog), ...current }
    setValue('inventoryCounts', next)
    setValue('totalInventoryItems', String(sumInventoryCounts(next)))
  }, [catalog, getValues, setValue])

  // Demo accounts only: fill the presentation details once, after the lists they refer to have
  // loaded. Fields the person already filled are never overwritten, and nothing is submitted.
  const demoApplied = useRef(false)
  const [demoPrefilled, setDemoPrefilled] = useState(false)
  useEffect(() => {
    if (demoApplied.current || confirmedRequestId || !isMovingDemoAccount(user)) return
    const floors = floorsQuery.data?.items ?? []
    if (catalog.length === 0 || floors.length === 0 || townshipNames.length === 0) return
    demoApplied.current = true
    const preset = MOVING_DEMO_PRESET
    const options = { shouldDirty: true }
    const fillIfEmpty = (name: 'pickupTownship' | 'dropoffTownship' | 'pickupFloorLevelId' | 'dropoffFloorLevelId' | 'moveInDate', value: string | undefined) => {
      if (value && !getValues(name)) setValue(name, value, options)
    }
    const floorId = (label: string) => floors.find((floor) => (floor.name ?? '').toLowerCase() === label.toLowerCase())?.id
    fillIfEmpty('pickupTownship', townshipNames.includes(preset.pickupTownship) ? preset.pickupTownship : undefined)
    fillIfEmpty('dropoffTownship', townshipNames.includes(preset.dropoffTownship) ? preset.dropoffTownship : undefined)
    fillIfEmpty('pickupFloorLevelId', floorId(preset.pickupFloor))
    fillIfEmpty('dropoffFloorLevelId', floorId(preset.dropoffFloor))
    fillIfEmpty('moveInDate', preset.moveInDate)
    const counts = { ...emptyInventoryCounts(catalog), ...getValues('inventoryCounts') }
    if (sumInventoryCounts(counts) === 0) {
      for (const item of catalog) {
        if (preset.inventory[item.code]) counts[item.id] = preset.inventory[item.code]
      }
      setValue('inventoryCounts', counts, options)
      setValue('totalInventoryItems', String(sumInventoryCounts(counts)), options)
    }
    setDemoPrefilled(true)
  }, [catalog, confirmedRequestId, floorsQuery.data?.items, getValues, setValue, townshipNames, user])

  const inventoryCounts = watch('inventoryCounts')
  const photo1 = watch('photo1')
  const photo2 = watch('photo2')
  const photo3 = watch('photo3')
  const photo4 = watch('photo4')
  const photo5 = watch('photo5')
  const pickupAddress = watch('pickupAddress')
  const dropoffAddress = watch('dropoffAddress')
  const vehicleTypeId = watch('vehicleTypeId')
  const photoPaths = useMemo(
    () => [photo1, photo2, photo3, photo4, photo5].map((path) => path.trim()).filter(Boolean),
    [photo1, photo2, photo3, photo4, photo5],
  )

  const setStep = (next: 1 | 2 | 3 | 4, requestId?: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('step', String(next))
    if (requestId) params.set('request', requestId)
    setSearchParams(params)
    // The buttons sit at the bottom of each step, so a new step has to start back at the top.
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const applyFieldErrors = (validationErrors: Record<string, string | undefined>) => {
    Object.entries(validationErrors).forEach(([key, message]) => {
      if (!message) return
      if (key === 'photos') {
        setError('photo1', { type: 'validate', message })
        return
      }
      setError(key as keyof MovingRequestFormValues, { type: 'validate', message })
    })
    // Continue is below the fields: bring the first problem into view once it has been drawn.
    window.setTimeout(() => {
      document.querySelector('[data-moving-form] .text-destructive')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const syncPhotoPaths = (paths: string[]) => {
    setValue('photo1', paths[0] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('photo2', paths[1] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('photo3', paths[2] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('photo4', paths[3] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('photo5', paths[4] ?? '', { shouldDirty: true, shouldTouch: true })
    if (paths.some((path) => path.trim())) {
      clearErrors('photo1')
    }
  }

  const updateInventoryCount = (id: string, next: number) => {
    const current = { ...getValues('inventoryCounts'), [id]: next }
    setValue('inventoryCounts', current, { shouldDirty: true })
    const sum = sumInventoryCounts(current)
    setValue('totalInventoryItems', String(sum), { shouldDirty: true, shouldTouch: true })
    if (sum > 0) {
      clearErrors('totalInventoryItems')
    }
  }

  const requestQuote = async (selectedVehicleTypeId?: string) => {
    const values = getValues()
    const pickup = parseCoordinatePair(values.pickupLatitude, values.pickupLongitude)
    const dropoff = parseCoordinatePair(values.dropoffLatitude, values.dropoffLongitude)
    const inventoryItems = buildInventoryItems(values.inventoryCounts, catalog).map((item) => ({
      inventoryItemTypeId: item.inventoryItemTypeId,
      count: item.count,
    }))
    setIsQuoting(true)
    setFormError(null)
    try {
      const result = await movingApi.quote({
        pickupAddress: values.pickupAddress.trim(),
        dropoffAddress: values.dropoffAddress.trim(),
        pickupLatitude: pickup?.lat,
        pickupLongitude: pickup?.lng,
        dropoffLatitude: dropoff?.lat,
        dropoffLongitude: dropoff?.lng,
        pickupFloorLevelId: values.pickupFloorLevelId,
        dropoffFloorLevelId: values.dropoffFloorLevelId,
        vehicleTypeId: selectedVehicleTypeId || undefined,
        inventoryItems,
      })
      setQuote(result.quote)
      setValue('vehicleTypeId', result.quote.selectedVehicleType.id)
      return result.quote
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFormError(error.message)
      } else {
        setFormError(t('moving.quoteFailed'))
      }
      return null
    } finally {
      setIsQuoting(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors()
    setFormError(null)
    const merged: MovingRequestFormValues = {
      ...values,
      inventoryCounts: getValues('inventoryCounts'),
      totalInventoryItems: getValues('totalInventoryItems'),
    }

    if (step === 1) {
      const stepErrors = validateMovingStep1(merged, t, townshipNames)
      if (Object.keys(stepErrors).length > 0) {
        applyFieldErrors(stepErrors)
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      const stepErrors = validateMovingStep2(merged, t)
      if (Object.keys(stepErrors).length > 0) {
        applyFieldErrors(stepErrors)
        return
      }
      const nextQuote = await requestQuote()
      if (!nextQuote) return
      setStep(3)
      return
    }

    if (step !== 3) return

    const step3Errors = validateMovingStep3(merged, t)
    if (Object.keys(step3Errors).length > 0) {
      applyFieldErrors(step3Errors)
      return
    }

    const inventoryItems = buildInventoryItems(merged.inventoryCounts, catalog).map((item) => ({
      inventoryItemTypeId: item.inventoryItemTypeId,
      count: item.count,
    }))

    try {
      const pickup = parseCoordinatePair(merged.pickupLatitude, merged.pickupLongitude)
      const dropoff = parseCoordinatePair(merged.dropoffLatitude, merged.dropoffLongitude)
      const result = await movingApi.create({
        pickupAddress: merged.pickupAddress.trim(),
        dropoffAddress: merged.dropoffAddress.trim(),
        pickupLatitude: pickup?.lat,
        pickupLongitude: pickup?.lng,
        dropoffLatitude: dropoff?.lat,
        dropoffLongitude: dropoff?.lng,
        pickupFloorLevelId: merged.pickupFloorLevelId,
        dropoffFloorLevelId: merged.dropoffFloorLevelId,
        moveInDate: new Date(merged.moveInDate).toISOString(),
        vehicleTypeId: merged.vehicleTypeId,
        remarks: merged.remarks.trim() || undefined,
        damageChecklist: merged.damageChecklist.trim() || undefined,
        photos: collectPhotoPaths(merged),
        inventoryItems,
      })
      setCreatedRequest(result.movingRequest)
      setStep(4, result.movingRequest.id)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFormError(error.message)
        return
      }
      setFormError(t('moving.submitFailed'))
    }
  })

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  const confirmationId = createdRequest?.id ?? confirmedRequestId
  const showConfirmation = step === 4 && Boolean(confirmationId)

  return (
    <Card className="mx-auto max-w-6xl">
      <CardHeader>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('moving.sloganTitle')}</h1>
          <p className="text-muted-foreground">{t('moving.sloganSubtitle')}</p>
        </div>
        <HireMovingStepProgress current={step} />
        {(bookingId || houseId) && (
          <p className="text-xs text-muted-foreground">
            {t('moving.bookingContext', {
              bookingId: bookingId ?? '—',
              houseId: houseId ?? '—',
            })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {showConfirmation && confirmationId ? (
          <HireMovingStepConfirmation requestId={confirmationId} initial={createdRequest?.id === confirmationId ? createdRequest : null} />
        ) : (
          <form data-moving-form className="space-y-6" onSubmit={onSubmit} noValidate>
            <input type="hidden" {...register('pickupAddress')} />
            <input type="hidden" {...register('dropoffAddress')} />
            <input type="hidden" {...register('pickupLatitude')} />
            <input type="hidden" {...register('pickupLongitude')} />
            <input type="hidden" {...register('dropoffLatitude')} />
            <input type="hidden" {...register('dropoffLongitude')} />
            <input type="hidden" {...register('photo1')} />
            <input type="hidden" {...register('photo2')} />
            <input type="hidden" {...register('photo3')} />
            <input type="hidden" {...register('photo4')} />
            <input type="hidden" {...register('photo5')} />
            <input type="hidden" {...register('totalInventoryItems')} />
            <input type="hidden" {...register('vehicleTypeId')} />

            {demoPrefilled && step < 4 ? (
              <p className="rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-sm text-info" role="status">
                {t('moving.demoPrefilled')}
              </p>
            ) : null}
            {step === 1 ? (
              <HireMovingStepAddresses
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                townships={townships}
              />
            ) : null}

            {step === 2 ? (
              <HireMovingStepDetails
                pickupAddress={pickupAddress}
                dropoffAddress={dropoffAddress}
                register={register}
                errors={errors}
                floors={floorsQuery.data?.items ?? []}
                catalog={catalog}
                inventoryCounts={inventoryCounts}
                totalInventoryItems={watch('totalInventoryItems')}
                photoPaths={photoPaths}
                onPhotoChange={syncPhotoPaths}
                onInventoryChange={updateInventoryCount}
                onBack={() => setStep(1)}
              />
            ) : null}

            {step === 3 ? (
              <HireMovingStepEstimate
                quote={quote}
                vehicles={vehiclesQuery.data?.items ?? []}
                vehicleTypeId={vehicleTypeId}
                onVehicleChange={(nextId) => {
                  setValue('vehicleTypeId', nextId)
                  void requestQuote(nextId)
                }}
                register={register}
                errors={errors}
                isQuoting={isQuoting}
                isSubmitting={isSubmitting}
                onBack={() => setStep(2)}
              />
            ) : null}

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </form>
        )}
        
      </CardContent>
    </Card>
  )
}
