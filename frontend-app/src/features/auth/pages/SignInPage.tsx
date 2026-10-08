import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateLoginForm, type LoginFormValues } from '@/features/auth/schemas/auth-schemas'
import { ApiRequestError } from '@/lib/api/client'
import type { AuthUser } from '@/features/auth/types'

type SignInPageProps = {
  redirectTo?: string
  titleKey?: string
}

function resolvePostLoginPath(
  user: AuthUser | null,
  preferredRedirect: string,
  locationState: unknown,
): string {
  const from =
    locationState && typeof locationState === 'object' && 'from' in locationState
      ? String((locationState as { from?: string }).from ?? '')
      : ''

  const candidate = from || preferredRedirect
  const isAdminDestination = candidate.startsWith('/admin')
  const isAdminUser = Boolean(user?.roles?.includes('admin'))

  if (isAdminDestination) {
    return isAdminUser ? candidate : '/'
  }

  return candidate || '/'
}

export function SignInPage({ redirectTo = '/', titleKey = 'public.signInTitle' }: SignInPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const authPrompt =
    location.state && typeof location.state === 'object' && 'authPrompt' in location.state
      ? String((location.state as { authPrompt?: string }).authPrompt ?? '')
      : ''

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const validationErrors = validateLoginForm(values, t)
    const keys = Object.keys(validationErrors) as Array<keyof LoginFormValues>
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
    try {
      const user = await login(values)
      const nextPath = resolvePostLoginPath(user, redirectTo, location.state)

      if (redirectTo.startsWith('/admin') && !user?.roles?.includes('admin')) {
        setFormError(t('auth.adminRequired'))
        return
      }

      // Replace the sign-in entry so Back from the destination doesn't return to this form.
      navigate(nextPath, { replace: true })
    } catch (error) {
      // Only an answer from the server means the credentials were rejected; anything else is a connection problem.
      setFormError(error instanceof ApiRequestError ? t('auth.loginFailed') : t('auth.serverUnreachable'))
    }
  })

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl">{t(titleKey)}</h1>
        </CardTitle>
        {authPrompt === 'wishlist' ? (
          <p className="text-sm text-muted-foreground">{t('auth.wishlistLoginPrompt')}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('rememberMe')} />
            {t('auth.rememberMe')}
          </label>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('auth.login')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link className="underline" to="/sign-up">
            {t('nav.signUp')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
