import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateRegisterForm, type RegisterFormValues } from '@/features/auth/schemas/auth-schemas'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { ApiRequestError } from '@/lib/api/client'

type SignUpPageProps = {
  redirectTo?: string
  titleKey?: string
}

export function SignUpPage({ redirectTo = '/sign-in', titleKey = 'public.signUpTitle' }: SignUpPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const occupationsQuery = useQuery({
    queryKey: ['master-data', 'occupations'],
    queryFn: () => masterDataApi.list('occupations'),
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      occupationId: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const validationErrors = validateRegisterForm(values, t)
    const keys = Object.keys(validationErrors) as Array<keyof RegisterFormValues>
    if (keys.length > 0) {
      keys.forEach((key) => {
        const message = validationErrors[key]
        if (message) {
          setError(key, { type: 'validate', message })
        }
      })
      return
    }

    setFormError(null)
    setSuccessMessage(null)
    try {
      await registerUser(values)
      setSuccessMessage(t('auth.registerSuccess'))
      // The sign-in form confirms the account exists and already holds the address just registered.
      navigate(redirectTo, { state: { registeredEmail: values.email.trim() } })
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        setFormError(t('auth.serverUnreachable'))
      } else if (error.code === 'AUTH_EMAIL_EXISTS') {
        // Say exactly what is taken: a generic failure leaves people guessing which details were registered.
        setError('email', { type: 'server', message: t('auth.emailExists') })
      } else if (error.code === 'AUTH_PHONE_EXISTS') {
        setError('phone', { type: 'server', message: t('auth.phoneExists') })
      } else if (error.code === 'OCCUPATION_INVALID') {
        setError('occupationId', { type: 'server', message: t('auth.required') })
      } else {
        setFormError(error.status === 400 && error.message ? t('auth.registerRejected', { reason: error.message }) : t('auth.registerFailed'))
      }
    }
  })

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl">{t(titleKey)}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.name')}</Label>
            <Input id="name" autoComplete="name" {...register('name')} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('auth.phone')}</Label>
            <Input id="phone" autoComplete="tel" {...register('phone')} />
            {errors.phone ? <p className="text-sm text-destructive">{errors.phone.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupationId">{t('auth.occupation')}</Label>
            <select
              id="occupationId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={occupationsQuery.isLoading}
              {...register('occupationId')}
            >
              <option value="">{t('auth.occupationPlaceholder')}</option>
              {(occupationsQuery.data?.items ?? []).map((occupation) => (
                <option key={occupation.id} value={occupation.id}>
                  {occupation.name}
                </option>
              ))}
            </select>
            {errors.occupationId ? <p className="text-sm text-destructive">{errors.occupationId.message}</p> : null}
            {occupationsQuery.isError ? <p className="text-sm text-destructive">{t('auth.occupationLoadError')}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          {successMessage ? <p className="text-sm text-primary">{successMessage}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('auth.register')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link className="underline" to="/sign-in">
            {t('nav.signIn')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
