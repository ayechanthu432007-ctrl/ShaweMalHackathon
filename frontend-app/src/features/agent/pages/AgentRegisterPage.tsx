import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
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

import { agentRegistrationApi } from '../api/agent-registration-api'
import {
  validateAgentRegistrationForm,
  type AgentRegistrationFormValues,
} from '../schemas/agent-registration-schema'

export function AgentRegisterPage() {
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

  const statesQuery = useQuery({
    queryKey: ['master-data', 'states'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('states'),
  })

  const citiesQuery = useQuery({
    queryKey: ['master-data', 'cities'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('cities'),
  })

  const regionsQuery = useQuery({
    queryKey: ['master-data', 'service-regions'],
    enabled: isAuthenticated,
    queryFn: () => masterDataApi.list('service-regions'),
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AgentRegistrationFormValues>({
    defaultValues: {
      name: user?.name ?? '',
      nrc: '',
      nrcFrontPhotoPath: '',
      nrcBackPhotoPath: '',
      profilePhotoPath: '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      telegram: '',
      viber: '',
      address1: '',
      address2: '',
      cityId: '',
      stateId: '',
      serviceRegionId: '',
      hasRentingExperience: 'no',
    },
  })

  const selectedStateId = watch('stateId')
  const cities = useMemo(() => {
    const items = citiesQuery.data?.items ?? []
    if (!selectedStateId) return items
    return items.filter((city) => !city.stateId || city.stateId === selectedStateId)
  }, [citiesQuery.data?.items, selectedStateId])

  const setPhotoPath = (field: 'nrcFrontPhotoPath' | 'nrcBackPhotoPath' | 'profilePhotoPath', path: string) => {
    setValue(field, path, { shouldDirty: true, shouldTouch: true })
    if (path.trim()) clearErrors(field)
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors()
    const validationErrors = validateAgentRegistrationForm(values, t)
    const keys = Object.keys(validationErrors) as Array<keyof AgentRegistrationFormValues>
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
      await agentRegistrationApi.submit({
        name: values.name.trim(),
        nrc: values.nrc.trim(),
        nrcFrontPhotoPath: values.nrcFrontPhotoPath.trim(),
        nrcBackPhotoPath: values.nrcBackPhotoPath.trim(),
        profilePhotoPath: values.profilePhotoPath.trim() || undefined,
        email: values.email.trim(),
        phone: values.phone.trim(),
        telegram: values.telegram.trim() || undefined,
        viber: values.viber.trim() || undefined,
        address1: values.address1.trim(),
        address2: values.address2.trim() || undefined,
        cityId: values.cityId,
        stateId: values.stateId,
        serviceRegionId: values.serviceRegionId,
        hasRentingExperience: values.hasRentingExperience === 'yes',
      })
      setSuccessMessage(t('agent.submitSuccess'))
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFormError(error.message)
        return
      }
      setFormError(t('agent.submitFailed'))
    }
  })

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-semibold tracking-tight">{t('public.agentRegisterTitle')}</h1>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('agent.subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
          <input type="hidden" {...register('nrcFrontPhotoPath')} />
          <input type="hidden" {...register('nrcBackPhotoPath')} />
          <input type="hidden" {...register('profilePhotoPath')} />

          <Field label={t('auth.name')} error={errors.name?.message}>
            <Input {...register('name')} />
          </Field>
          <Field label={t('agent.nrc')} error={errors.nrc?.message}>
            <Input maxLength={15} {...register('nrc')} />
          </Field>
          <Field label={t('agent.profilePhoto')} error={errors.profilePhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('profilePhotoPath')}
              onChange={(path) => setPhotoPath('profilePhotoPath', path)}
              category="profile"
              error={errors.profilePhotoPath?.message}
            />
            <p className="text-xs text-muted-foreground">{t('agent.profilePhotoHint')}</p>
          </Field>
          <Field label={t('agent.nrcFrontPhotoPath')} error={errors.nrcFrontPhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('nrcFrontPhotoPath')}
              onChange={(path) => setPhotoPath('nrcFrontPhotoPath', path)}
              category="docs"
              error={errors.nrcFrontPhotoPath?.message}
            />
          </Field>
          <Field label={t('agent.nrcBackPhotoPath')} error={errors.nrcBackPhotoPath?.message} className="sm:col-span-2">
            <SingleImageUploadField
              path={watch('nrcBackPhotoPath')}
              onChange={(path) => setPhotoPath('nrcBackPhotoPath', path)}
              category="docs"
              error={errors.nrcBackPhotoPath?.message}
            />
          </Field>
          <Field label={t('auth.email')} error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label={t('auth.phone')} error={errors.phone?.message}>
            <Input {...register('phone')} />
          </Field>
          <Field label={t('agent.telegram')} error={errors.telegram?.message}>
            <Input {...register('telegram')} />
          </Field>
          <Field label={t('agent.viber')} error={errors.viber?.message}>
            <Input {...register('viber')} />
          </Field>
          <Field label={t('agent.address1')} error={errors.address1?.message} className="sm:col-span-2">
            <Input {...register('address1')} />
          </Field>
          <Field label={t('agent.address2')} error={errors.address2?.message} className="sm:col-span-2">
            <Input {...register('address2')} />
          </Field>
          <Field label={t('agent.state')} error={errors.stateId?.message}>
            <select className={selectClassName} {...register('stateId')}>
              <option value="">{t('houses.filters.any')}</option>
              {(statesQuery.data?.items ?? []).map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('agent.city')} error={errors.cityId?.message}>
            <select className={selectClassName} {...register('cityId')}>
              <option value="">{t('houses.filters.any')}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('agent.serviceRegion')} error={errors.serviceRegionId?.message} className="sm:col-span-2">
            <select className={selectClassName} {...register('serviceRegionId')}>
              <option value="">{t('houses.filters.any')}</option>
              {(regionsQuery.data?.items ?? []).map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">{t('agent.hasRentingExperience')}</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" value="yes" {...register('hasRentingExperience')} />
                {t('common.yes')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="no" {...register('hasRentingExperience')} />
                {t('common.no')}
              </label>
            </div>
          </fieldset>

          {formError ? <p className="text-sm text-destructive sm:col-span-2">{formError}</p> : null}
          {successMessage ? <p className="text-sm text-primary sm:col-span-2">{successMessage}</p> : null}

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('agent.submit')}
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
