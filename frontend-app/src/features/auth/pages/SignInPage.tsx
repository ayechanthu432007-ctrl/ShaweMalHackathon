import { Eye, EyeOff, Headset, Home, Lock, Mail, Package, ShieldCheck, Sparkles, Store, Truck, UserRoundCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateLoginForm, type LoginFormValues } from '@/features/auth/schemas/auth-schemas'
import shawemalLogo from '@/assets/shawemal-logo.png'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/features/auth/types'

const inputClassName = 'h-11 rounded-xl border-[#D5E2F0] bg-[#F7FAFD] pl-10 transition-colors focus-visible:border-[#477FAF] focus-visible:bg-white focus-visible:ring-[#477FAF]/25 dark:border-input dark:bg-transparent'

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
  const [showPassword, setShowPassword] = useState(false)

  const authPrompt =
    location.state && typeof location.state === 'object' && 'authPrompt' in location.state
      ? String((location.state as { authPrompt?: string }).authPrompt ?? '')
      : ''

  // Arriving straight from sign-up: confirm the account exists and fill in its address.
  const registeredEmail =
    location.state && typeof location.state === 'object' && 'registeredEmail' in location.state
      ? String((location.state as { registeredEmail?: string }).registeredEmail ?? '')
      : ''

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: registeredEmail,
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
      if (!(error instanceof ApiRequestError)) {
        setFormError(t('auth.serverUnreachable'))
      } else if (error.code === 'AUTH_ACCOUNT_BANNED' || error.code === 'AUTH_ACCOUNT_SUSPENDED') {
        setFormError(t('auth.accountBlocked'))
      } else {
        setFormError(t('auth.loginFailed'))
      }
    }
  })

  const highlights = [
    { icon: Sparkles, title: t('auth.signInFeatureSimple'), body: t('auth.signInFeatureSimpleBody') },
    { icon: ShieldCheck, title: t('auth.signInFeatureTrusted'), body: t('auth.signInFeatureTrustedBody') },
    { icon: Store, title: t('auth.signInFeatureMarket'), body: t('auth.signInFeatureMarketBody') },
    { icon: UserRoundCheck, title: t('auth.signInFeatureForYou'), body: t('auth.signInFeatureForYouBody') },
    { icon: Headset, title: t('auth.signInFeatureSupport'), body: t('auth.signInFeatureSupportBody') },
  ]

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-8 py-2 lg:min-h-[calc(100vh-var(--site-header-h,8rem)-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-14">
      {/* ---------- brand side ---------- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#24476A] to-[#3F6F9F] p-6 text-white shadow-lg shadow-[#24476A]/20 sm:p-8 lg:p-10 dark:from-primary dark:to-primary/80 dark:text-primary-foreground">
        {/* Soft decorative rings, kept faint so the text stays the focus. */}
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border-[18px] border-white/[0.06]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C69245] via-[#C69245]/60 to-transparent" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <img src={shawemalLogo} alt="" className="size-11 rounded-xl bg-white object-contain p-1 shadow-sm" />
            <span className="text-lg font-bold tracking-tight">{t('common.appName')}</span>
          </div>
          <h2 className="mt-6 text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-[2.1rem]">{t('auth.signInWelcomeTitle')}</h2>
          <p className="mt-2 text-lg font-semibold text-primary-foreground/95 sm:text-xl">{t('auth.signInWelcomeSubtitle')}</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-primary-foreground/85 sm:text-base">{t('auth.signInWelcomeBody')}</p>

          {/* A small moving scene: home, the road, and the truck carrying the boxes. Hidden on phones. */}
          <div aria-hidden className="mt-6 hidden items-center gap-3 sm:flex">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15"><Home className="size-6" /></span>
            <span className="h-px flex-1 border-t-2 border-dashed border-white/40" />
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-[#24476A] shadow-md ring-2 ring-[#C69245]/60"><Truck className="size-7" /></span>
            <span className="h-px flex-1 border-t-2 border-dashed border-white/40" />
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15"><Package className="size-6" /></span>
          </div>

          <ul className="mt-6 space-y-2.5">
            {highlights.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#E2B877] ring-1 ring-white/10">
                  <item.icon className="size-[1.1rem]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="hidden text-sm text-primary-foreground/75 sm:block">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- sign-in card ---------- */}
      <section className="order-first rounded-3xl border bg-card p-6 shadow-xl shadow-black/5 sm:p-8 lg:order-none">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t(titleKey)}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('auth.signInSubtitle')}</p>

        {registeredEmail || authPrompt === 'wishlist' || authPrompt === 'moving' ? (
          <div className="mt-4 space-y-2">
            {registeredEmail ? (
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
                {t('auth.accountCreated', { email: registeredEmail })}
              </p>
            ) : null}
            {authPrompt === 'wishlist' ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('auth.wishlistLoginPrompt')}</p> : null}
            {authPrompt === 'moving' ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('auth.movingLoginPrompt')}</p> : null}
          </div>
        ) : null}

        <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                className={cn(inputClassName, errors.email && 'border-destructive focus-visible:ring-destructive/40')}
                {...register('email')}
              />
            </div>
            {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                className={cn(inputClassName, 'pr-11', errors.password && 'border-destructive focus-visible:ring-destructive/40')}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register('rememberMe')} />
            {t('auth.rememberMe')}
          </label>
          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full rounded-xl bg-[#477FAF] text-base font-semibold text-white shadow-md shadow-[#477FAF]/25 transition-colors hover:bg-[#3A6B95] dark:bg-button dark:text-button-foreground dark:hover:bg-button-hover" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('auth.login')}
          </Button>
        </form>
        <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/sign-up">
            {t('nav.signUp')}
          </Link>
        </p>
      </section>
    </div>
  )
}
