import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { MultiImageUploadField } from '@/components/uploads/MultiImageUploadField'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HouseLocationMap } from '@/features/houses/components/HouseLocationMap'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { ApiRequestError } from '@/lib/api/client'

import { agentHousesApi } from '../api/agent-houses-api'
import {
  defaultAgentHouseFormValues,
  houseToFormValues,
  toAgentHouseInput,
  validateAgentHouseForm,
  type AgentHouseFormErrorKey,
  type AgentHouseFormValues,
} from '../schemas/agent-house-schema'

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function isVerifiedAgent(status: string | null | undefined): boolean {
  return (status ?? '').toUpperCase() === 'VERIFIED'
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  )
}

export function AgentHouseFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const isAgent = Boolean(user?.roles?.includes('agent'))
  const verified = isVerifiedAgent(user?.agentVerificationStatus)

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const propertyTypesQuery = useQuery({
    queryKey: ['master-data', 'property-types'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => masterDataApi.list('property-types'),
  })
  const contractTypesQuery = useQuery({
    queryKey: ['master-data', 'contract-types'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => masterDataApi.list('contract-types'),
  })
  const floorLevelsQuery = useQuery({
    queryKey: ['master-data', 'floor-levels'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => masterDataApi.list('floor-levels'),
  })
  const citiesQuery = useQuery({
    queryKey: ['master-data', 'cities'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => masterDataApi.list('cities'),
  })
  const statesQuery = useQuery({
    queryKey: ['master-data', 'states'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => masterDataApi.list('states'),
  })
  const amenitiesQuery = useQuery({
    queryKey: ['master-data', 'amenities'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => masterDataApi.list('amenities'),
  })

  const housesQuery = useQuery({
    queryKey: ['agent-houses'],
    enabled: isAuthenticated && isAgent && isEdit,
    queryFn: () => agentHousesApi.list(),
  })

  const existingHouse = useMemo(() => {
    if (!isEdit || !id) return null
    return housesQuery.data?.items.find((item) => item.id === id) ?? null
  }, [housesQuery.data?.items, id, isEdit])

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AgentHouseFormValues>({
    defaultValues: defaultAgentHouseFormValues(),
  })

  useEffect(() => {
    if (existingHouse) {
      reset({ ...houseToFormValues(existingHouse), postChannel: 'agent' })
    }
  }, [existingHouse, reset])

  const selectedStateId = watch('stateId')
  const selectedCityId = watch('cityId')
  const streetAddress = watch('streetAddress')
  const latitude = watch('latitude')
  const longitude = watch('longitude')
  const image1 = watch('image1')
  const image2 = watch('image2')
  const image3 = watch('image3')
  const image4 = watch('image4')
  const image5 = watch('image5')
  const imagePaths = useMemo(
    () => [image1, image2, image3, image4, image5].map((path) => path.trim()).filter(Boolean),
    [image1, image2, image3, image4, image5],
  )

  const syncImagePaths = (paths: string[]) => {
    setValue('image1', paths[0] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('image2', paths[1] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('image3', paths[2] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('image4', paths[3] ?? '', { shouldDirty: true, shouldTouch: true })
    setValue('image5', paths[4] ?? '', { shouldDirty: true, shouldTouch: true })
    if (paths.some((path) => path.trim())) {
      clearErrors('image1')
    }
  }

  const filteredCities = useMemo(() => {
    const items = citiesQuery.data?.items ?? []
    if (!selectedStateId) return items
    return items.filter((city) => !city.stateId || city.stateId === selectedStateId)
  }, [citiesQuery.data?.items, selectedStateId])

  const selectedCityName = filteredCities.find((item) => item.id === selectedCityId)?.name
  const selectedStateName = (statesQuery.data?.items ?? []).find((item) => item.id === selectedStateId)?.name

  const masterDataLoading =
    propertyTypesQuery.isLoading ||
    contractTypesQuery.isLoading ||
    floorLevelsQuery.isLoading ||
    citiesQuery.isLoading ||
    statesQuery.isLoading ||
    amenitiesQuery.isLoading

  const onSubmit = handleSubmit(async (values) => {
    if (!verified) {
      setFormError(t('agent.houses.verificationRequired'))
      return
    }

    const validationErrors = validateAgentHouseForm(values, t)
    const keys = Object.keys(validationErrors) as AgentHouseFormErrorKey[]
    if (keys.length > 0) {
      keys.forEach((key) => {
        const message = validationErrors[key]
        if (!message) return
        if (key === 'imagePaths') {
          setError('image1', { type: 'validate', message })
          return
        }
        setError(key as keyof AgentHouseFormValues, { type: 'validate', message })
      })
      return
    }

    setFormError(null)
    const payload = toAgentHouseInput({ ...values, postChannel: 'agent' })

    try {
      if (isEdit && id) {
        await agentHousesApi.update(id, payload)
      } else {
        await agentHousesApi.create(payload)
      }
      navigate('/agent/houses')
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError
          ? error.message
          : isEdit
            ? t('agent.houses.updateFailed')
            : t('agent.houses.createFailed'),
      )
    }
  })

  if (isBootstrapping || !isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (!isAgent) {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t('agent.houses.formTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.roleRequired')}</p>
        <Button asChild variant="outline">
          <Link to="/agent-register">{t('nav.agentRegister')}</Link>
        </Button>
      </section>
    )
  }

  if (isEdit && housesQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (isEdit && housesQuery.isError) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-destructive" role="alert">
          {t('agent.houses.listError')}
        </p>
        <Button type="button" variant="outline" onClick={() => void housesQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </section>
    )
  }

  if (isEdit && !existingHouse) {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t('agent.houses.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/agent/houses">{t('agent.houses.backToList')}</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <BackButton fallback="/agent/houses" confirmMessage={isDirty && !isSubmitting ? t('common.discardChanges') : null} />
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {isEdit ? t('agent.houses.editTitle') : t('agent.houses.createTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.formSubtitle')}</p>
      </div>

      {!verified ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
        >
          {t('agent.houses.verificationRequired')}
        </div>
      ) : null}

      {masterDataLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('agent.houses.formTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={(event) => void onSubmit(event)} noValidate>
            <input type="hidden" {...register('image1')} />
            <input type="hidden" {...register('image2')} />
            <input type="hidden" {...register('image3')} />
            <input type="hidden" {...register('image4')} />
            <input type="hidden" {...register('image5')} />
            <input type="hidden" {...register('postChannel')} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">{t('agent.houses.fields.title')}</Label>
                <Input id="title" {...register('title')} disabled={!verified} />
                <FieldError message={errors.title?.message} />
              </div>

              

              <div className="space-y-2">
                <Label htmlFor="availability">{t('agent.houses.availability')}</Label>
                <select
                  id="availability"
                  className={selectClassName}
                  {...register('availability')}
                  disabled={!verified}
                >
                  <option value="available">{t('agent.houses.available')}</option>
                  <option value="not_available">{t('agent.houses.notAvailable')}</option>
                </select>
                <FieldError message={errors.availability?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyTypeId">{t('houses.filters.type')}</Label>
                <select
                  id="propertyTypeId"
                  className={selectClassName}
                  {...register('propertyTypeId')}
                  disabled={!verified}
                >
                  <option value="">{t('houses.filters.any')}</option>
                  {(propertyTypesQuery.data?.items ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.propertyTypeId?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="floorLevelId">{t('agent.houses.fields.floorLevel')}</Label>
                <select
                  id="floorLevelId"
                  className={selectClassName}
                  {...register('floorLevelId')}
                  disabled={!verified}
                >
                  <option value="">{t('houses.filters.any')}</option>
                  {(floorLevelsQuery.data?.items ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="areaSize">{t('houses.areaSize')}</Label>
                <Input id="areaSize" {...register('areaSize')} disabled={!verified} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bedrooms">{t('houses.bedrooms')}</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min={0}
                  step={1}
                  {...register('bedrooms')}
                  disabled={!verified}
                />
                <FieldError message={errors.bedrooms?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bathrooms">{t('houses.bathrooms')}</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min={0}
                  step={1}
                  {...register('bathrooms')}
                  disabled={!verified}
                />
                <FieldError message={errors.bathrooms?.message} />
              </div>
            </div>

            <fieldset className="space-y-4 rounded-md border p-4">
              <legend className="px-1 text-sm font-medium">{t('agent.houses.contractAndFee')}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractTypeId">{t('houses.contractType')}</Label>
                  <select
                    id="contractTypeId"
                    className={selectClassName}
                    {...register('contractTypeId')}
                    disabled={!verified}
                  >
                    <option value="">{t('houses.filters.any')}</option>
                    {(contractTypesQuery.data?.items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.contractTypeId?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyFees">{t('houses.monthlyFeesLabel')}</Label>
                  <Input
                    id="monthlyFees"
                    type="number"
                    min={0}
                    step="0.01"
                    {...register('monthlyFees')}
                    disabled={!verified}
                  />
                  <FieldError message={errors.monthlyFees?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depositAmount">{t('houses.depositLabel')}</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    {...register('depositAmount')}
                    disabled={!verified}
                  />
                  <FieldError message={errors.depositAmount?.message} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-md border p-4">
              <legend className="px-1 text-sm font-medium">{t('agent.houses.location')}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stateId">{t('agent.state')}</Label>
                  <select
                    id="stateId"
                    className={selectClassName}
                    {...register('stateId')}
                    disabled={!verified}
                  >
                    <option value="">{t('houses.filters.any')}</option>
                    {(statesQuery.data?.items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.stateId?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cityId">{t('agent.city')}</Label>
                  <select
                    id="cityId"
                    className={selectClassName}
                    {...register('cityId')}
                    disabled={!verified}
                  >
                    <option value="">{t('houses.filters.any')}</option>
                    {filteredCities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.cityId?.message} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="streetAddress">{t('houses.streetAddress')}</Label>
                  <Input id="streetAddress" {...register('streetAddress')} disabled={!verified} />
                  <FieldError message={errors.streetAddress?.message} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="nearbyPlaces">{t('houses.nearbyPlaces')}</Label>
                  <Input id="nearbyPlaces" {...register('nearbyPlaces')} disabled={!verified} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm font-medium">{t('houses.mapTitle')}</p>
                  <HouseLocationMap
                    streetAddress={streetAddress}
                    cityName={selectedCityName}
                    stateName={selectedStateName}
                    latitude={latitude}
                    longitude={longitude}
                    interactive
                    disabled={!verified}
                    onPinChange={(coords) => {
                      if (!coords) {
                        setValue('latitude', '', { shouldDirty: true })
                        setValue('longitude', '', { shouldDirty: true })
                        return
                      }
                      setValue('latitude', String(coords.latitude), { shouldDirty: true })
                      setValue('longitude', String(coords.longitude), { shouldDirty: true })
                      clearErrors(['latitude', 'longitude'])
                    }}
                  />
                  <FieldError message={errors.latitude?.message ?? errors.longitude?.message} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-md border p-4">
              <legend className="px-1 text-sm font-medium">{t('agent.houses.contactInformation')}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactPhoneNumber">{t('houses.contactPhone')}</Label>
                  <Input
                    id="contactPhoneNumber"
                    {...register('contactPhoneNumber')}
                    disabled={!verified}
                  />
                  <FieldError message={errors.contactPhoneNumber?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactTelegram">{t('agent.telegram')}</Label>
                  <Input id="contactTelegram" {...register('contactTelegram')} disabled={!verified} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactViber">{t('agent.viber')}</Label>
                  <Input id="contactViber" {...register('contactViber')} disabled={!verified} />
                </div>
              </div>
            </fieldset>

            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-medium">{t('agent.houses.imagesTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('agent.houses.imagesHint')}</p>
              </div>
              <MultiImageUploadField
                paths={imagePaths}
                onChange={syncImagePaths}
                category="houses"
                maxFiles={5}
                disabled={!verified}
                error={errors.image1?.message}
              />
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium">{t('houses.amenities')}</h2>
              <Controller
                control={control}
                name="amenityIds"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(amenitiesQuery.data?.items ?? []).map((item) => {
                      const checked = field.value.includes(item.id)
                      return (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 rounded border border-input"
                            checked={checked}
                            disabled={!verified}
                            onChange={(event) => {
                              if (event.target.checked) {
                                field.onChange([...field.value, item.id])
                              } else {
                                field.onChange(field.value.filter((idValue) => idValue !== item.id))
                              }
                            }}
                          />
                          <span>{item.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="postChannel">{t('agent.houses.postChannel')}</Label>
                <select
                  id="postChannel"
                  className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-50`}
                  value="agent"
                  disabled
                >
                  <option value="agent">{t('agent.houses.postChannelAgent')}</option>
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="houseRules">{t('houses.houseRules')}</Label>
                <textarea
                  id="houseRules"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('houseRules')}
                  disabled={!verified}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">{t('agent.houses.fields.description')}</Label>
                <textarea
                  id="description"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('description')}
                  disabled={!verified}
                />
              </div>
              
            </div>

            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!verified || isSubmitting}>
                {isSubmitting
                  ? t('common.loading')
                  : isEdit
                    ? t('agent.houses.updateSubmit')
                    : t('agent.houses.createSubmit')}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/agent/houses">{t('common.cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
