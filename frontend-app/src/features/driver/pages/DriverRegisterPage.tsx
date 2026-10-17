import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SingleImageUploadField } from '@/components/uploads/SingleImageUploadField'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { ApiRequestError } from '@/lib/api/client'

import { driverRegistrationApi } from '../api/driver-api'
import {
  validateDriverRegistrationForm,
  type DriverRegistrationFormValues,
} from '../schemas/driver-registration-schema'

export function DriverRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const vehiclesQuery = useQuery({
    queryKey: ['master-data', 'vehicle-types'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('vehicle-types'),
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<DriverRegistrationFormValues>({
    defaultValues: {
      name: user?.name ?? '',
      companyName: '',
      nrc: '',
      nrcFrontPhotoPath: '',
      nrcBackPhotoPath: '',
      drivingLicensePhotoPath: '',
      profilePhotoPath: '',
      phone: user?.phone ?? '',
      currentAddress: '',
      vehicleTypeId: '',
      vehicleLicensePlateNumber: '',
      vehiclePhotoPath: '',
      wheelTaxPhotoPath: '',
    },
  })

  const setPhotoPath = (field: keyof DriverRegistrationFormValues, path: string) => {
    setValue(field, path, { shouldDirty: true, shouldTouch: true })
    if (path.trim()) {
      clearErrors(field)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors()
    const validationErrors = validateDriverRegistrationForm(values, t)
    const keys = Object.keys(validationErrors) as Array<keyof DriverRegistrationFormValues>
    if (keys.length > 0) {
      keys.forEach((key) => {
        const message = validationErrors[key]
        if (message) setError(key, { type: 'validate', message })
      })
      return
    }

    setFormError(null)
    setSuccessMessage(null)

    try {
      await driverRegistrationApi.submit({
        name: values.name.trim(),
        companyName: values.companyName.trim() || undefined,
        nrc: values.nrc.trim(),
        nrcFrontPhotoPath: values.nrcFrontPhotoPath.trim(),
        nrcBackPhotoPath: values.nrcBackPhotoPath.trim(),
        drivingLicensePhotoPath: values.drivingLicensePhotoPath.trim(),
        profilePhotoPath: values.profilePhotoPath.trim(),
        phone: values.phone.trim(),
        currentAddress: values.currentAddress.trim(),
        vehicleTypeId: values.vehicleTypeId,
        vehicleLicensePlateNumber: values.vehicleLicensePlateNumber.trim(),
        vehiclePhotoPath: values.vehiclePhotoPath.trim(),
        wheelTaxPhotoPath: values.wheelTaxPhotoPath.trim(),
      })
      setSuccessMessage(t('driver.submitSuccess'))
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFormError(error.message)
        return
      }
      setFormError(t('driver.submitFailed'))
    }
  })

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-semibold tracking-tight">{t('nav.driverRegister')}</h1>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('driver.subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
          {/* Keep upload paths registered so handleSubmit includes them */}
          <input type="hidden" {...register('nrcFrontPhotoPath')} />
          <input type="hidden" {...register('nrcBackPhotoPath')} />
          <input type="hidden" {...register('drivingLicensePhotoPath')} />
          <input type="hidden" {...register('profilePhotoPath')} />
          <input type="hidden" {...register('vehiclePhotoPath')} />
          <input type="hidden" {...register('wheelTaxPhotoPath')} />

          <Field label={t('auth.name')} error={errors.name?.message}>
            <Input {...register('name')} />
          </Field>
          <Field label={t('driver.companyName')} error={errors.companyName?.message}>
            <Input {...register('companyName')} />
          </Field>
          <Field label={t('driver.nrc')} error={errors.nrc?.message}>
            <Input maxLength={15} {...register('nrc')} />
          </Field>
          <Field label={t('auth.phone')} error={errors.phone?.message}>
            <Input {...register('phone')} />
          </Field>
          <Field label={t('driver.nrcFrontPhotoPath')} error={errors.nrcFrontPhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('nrcFrontPhotoPath')}
              onChange={(path) => setPhotoPath('nrcFrontPhotoPath', path)}
              category="docs"
              error={errors.nrcFrontPhotoPath?.message}
            />
          </Field>
          <Field label={t('driver.nrcBackPhotoPath')} error={errors.nrcBackPhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('nrcBackPhotoPath')}
              onChange={(path) => setPhotoPath('nrcBackPhotoPath', path)}
              category="docs"
              error={errors.nrcBackPhotoPath?.message}
            />
          </Field>
          <Field label={t('driver.drivingLicensePhotoPath')} error={errors.drivingLicensePhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('drivingLicensePhotoPath')}
              onChange={(path) => setPhotoPath('drivingLicensePhotoPath', path)}
              category="docs"
              error={errors.drivingLicensePhotoPath?.message}
            />
          </Field>
          <Field label={t('driver.profilePhotoPath')} error={errors.profilePhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('profilePhotoPath')}
              onChange={(path) => setPhotoPath('profilePhotoPath', path)}
              category="profile"
              error={errors.profilePhotoPath?.message}
            />
          </Field>
          <Field label={t('driver.vehiclePhotoPath')} error={errors.vehiclePhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('vehiclePhotoPath')}
              onChange={(path) => setPhotoPath('vehiclePhotoPath', path)}
              category="docs"
              error={errors.vehiclePhotoPath?.message}
            />
          </Field>
          <Field label={t('driver.wheelTaxPhotoPath')} error={errors.wheelTaxPhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('wheelTaxPhotoPath')}
              onChange={(path) => setPhotoPath('wheelTaxPhotoPath', path)}
              category="docs"
              error={errors.wheelTaxPhotoPath?.message}
            />
          </Field>
          <Field label={t('driver.currentAddress')} error={errors.currentAddress?.message} className="sm:col-span-2">
            <Input {...register('currentAddress')} />
          </Field>
          <Field label={t('moving.vehicleType')} error={errors.vehicleTypeId?.message}>
            <select className={selectClassName} {...register('vehicleTypeId')}>
              <option value="">{t('houses.filters.any')}</option>
              {(vehiclesQuery.data?.items ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('driver.vehicleLicensePlateNumber')} error={errors.vehicleLicensePlateNumber?.message}>
            <Input {...register('vehicleLicensePlateNumber')} />
          </Field>

          {formError ? <p className="text-sm text-destructive sm:col-span-2">{formError}</p> : null}
          {successMessage ? <p className="text-sm text-primary sm:col-span-2">{successMessage}</p> : null}

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('driver.submit')}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/">{t('nav.home')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
