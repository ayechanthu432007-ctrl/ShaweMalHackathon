import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { marketplaceApi } from '../api/marketplace-api'
import { selectClassName, textareaClassName } from '../components/MarketplaceDialog'
import { MarketplacePhotoUploader } from '../components/MarketplacePhotoUploader'
import { useMarketplaceCategories, useSellerStatus, useTownships } from '../hooks/useMarketplaceData'
import { categoryLabel } from '../lib/marketplace-format'
import {
  LISTING_CONDITIONS,
  PICKUP_METHODS,
  type ListingCondition,
  type ListingFormValues,
  type PickupMethod,
  type SellerContactSettings,
} from '../types'

type Step = 1 | 2 | 3 | 4
const STEPS: Step[] = [1, 2, 3, 4]

type FormState = {
  images: string[]
  coverIndex: number
  title: string
  categoryId: string
  subcategoryId: string
  price: string
  condition: ListingCondition | ''
  description: string
  cityId: string
  locationDetail: string
  pickupMethod: PickupMethod | ''
  movingOutSaleId: string
  showPhone: boolean
  showTelegram: boolean
  showViber: boolean
  policyAccepted: boolean
}

type Errors = Partial<Record<keyof FormState | 'contact', string>>

const EMPTY_FORM: FormState = {
  images: [],
  coverIndex: 0,
  title: '',
  categoryId: '',
  subcategoryId: '',
  price: '',
  condition: '',
  description: '',
  cityId: '',
  locationDetail: '',
  pickupMethod: '',
  movingOutSaleId: '',
  showPhone: true,
  showTelegram: true,
  showViber: true,
  policyAccepted: false,
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null
}

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError message={error} />
    </div>
  )
}

export function SellItemPage() {
  const { t, i18n } = useTranslation()
  const { id: editingId } = useParams()
  const isEditing = Boolean(editingId)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isAuthenticated, isBootstrapping } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [dirty, setDirty] = useState(false)
  const [contact, setContact] = useState<SellerContactSettings | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const statusQuery = useSellerStatus()
  const categoriesQuery = useMarketplaceCategories()
  const townshipsQuery = useTownships()
  const dashboardQuery = useQuery({
    queryKey: ['marketplace', 'my-dashboard', 'all'],
    enabled: isAuthenticated,
    queryFn: () => marketplaceApi.dashboard(),
  })
  const existingQuery = useQuery({
    queryKey: ['marketplace', 'my-listing', editingId],
    enabled: isAuthenticated && isEditing,
    queryFn: () => marketplaceApi.getMyListing(editingId as string),
  })

  useEffect(() => {
    if (statusQuery.data && !contact) {
      setContact(statusQuery.data.contact)
    }
  }, [statusQuery.data, contact])

  useEffect(() => {
    const listing = existingQuery.data?.listing
    if (!listing) return
    setForm({
      images: listing.images,
      coverIndex: listing.coverIndex,
      title: listing.title,
      categoryId: listing.categoryId,
      subcategoryId: listing.subcategoryId ?? '',
      price: String(listing.price),
      condition: listing.condition,
      description: listing.description,
      cityId: listing.cityId,
      locationDetail: listing.locationDetail ?? '',
      pickupMethod: listing.pickupMethod,
      movingOutSaleId: listing.movingOutSaleId ?? '',
      showPhone: listing.showPhone,
      showTelegram: listing.showTelegram,
      showViber: listing.showViber,
      policyAccepted: false,
    })
  }, [existingQuery.data])

  const categories = categoriesQuery.data ?? []
  const selectedCategory = categories.find((category) => category.id === form.categoryId)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
    setDirty(true)
  }

  const validateStep = (target: Step): Errors => {
    const next: Errors = {}
    if (target === 1 && form.images.length === 0) next.images = t('marketplace.sell.errors.photos')
    if (target === 2) {
      if (form.title.trim().length < 3) next.title = t('marketplace.sell.errors.title')
      if (!form.categoryId) next.categoryId = t('marketplace.sell.errors.category')
      if (selectedCategory && selectedCategory.children.length > 0 && !form.subcategoryId) next.subcategoryId = t('marketplace.sell.errors.subcategory')
      if (form.price.trim() === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) next.price = t('marketplace.sell.errors.price')
      if (!form.condition) next.condition = t('marketplace.sell.errors.condition')
      if (form.description.trim().length < 10) next.description = t('marketplace.sell.errors.description')
    }
    if (target === 3) {
      if (!form.cityId) next.cityId = t('marketplace.sell.errors.township')
      if (!form.pickupMethod) next.pickupMethod = t('marketplace.sell.errors.pickup')
    }
    if (target === 4) {
      const hasMethod =
        (form.showPhone && Boolean(contact?.phone?.trim())) ||
        (form.showTelegram && Boolean(contact?.telegramUsername?.trim())) ||
        (form.showViber && Boolean(contact?.viberNumber?.trim()))
      if (!hasMethod) next.contact = t('marketplace.sell.errors.contact')
      const phonePattern = /^\+?[\d\s-]{6,20}$/
      if (contact?.phone?.trim() && !phonePattern.test(contact.phone.trim())) next.contact = t('marketplace.sell.errors.phoneFormat')
      if (contact?.viberNumber?.trim() && !phonePattern.test(contact.viberNumber.trim())) next.contact = t('marketplace.sell.errors.phoneFormat')
      if (contact?.telegramUsername?.trim() && !/^@?[A-Za-z0-9_]{5,32}$/.test(contact.telegramUsername.trim())) {
        next.contact = t('marketplace.sell.errors.telegramFormat')
      }
      if (!form.policyAccepted) next.policyAccepted = t('marketplace.sell.errors.policy')
    }
    return next
  }

  const goTo = (target: Step) => {
    // Moving forward requires every earlier step to be valid.
    for (const earlier of STEPS.filter((value) => value < target)) {
      const stepErrors = validateStep(earlier)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        setStep(earlier)
        return
      }
    }
    setErrors({})
    setStep(target)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (contact) {
        await marketplaceApi.updateContact({
          ...contact,
          phone: contact.phone?.trim() || null,
          telegramUsername: contact.telegramUsername?.trim() || null,
          viberNumber: contact.viberNumber?.trim() || null,
        })
      }

      const payload: ListingFormValues = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || null,
        price: Number(form.price),
        condition: form.condition as ListingCondition,
        cityId: form.cityId,
        locationDetail: form.locationDetail.trim() || null,
        pickupMethod: form.pickupMethod as PickupMethod,
        images: form.images,
        coverIndex: form.coverIndex,
        showPhone: form.showPhone,
        showTelegram: form.showTelegram,
        showViber: form.showViber,
        movingOutSaleId: form.movingOutSaleId || null,
        policyAccepted: form.policyAccepted,
      }

      return isEditing ? marketplaceApi.updateListing(editingId as string, payload) : marketplaceApi.createListing(payload)
    },
    onSuccess: async ({ listing }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
        queryClient.invalidateQueries({ queryKey: ['wishlist', 'listings'] }),
      ])
      navigate(`/marketplace/items/${listing.id}`, { replace: true })
    },
  })

  const onPublish = () => {
    const allErrors = STEPS.reduce<Errors>((acc, value) => ({ ...acc, ...validateStep(value) }), {})
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      const firstInvalid = STEPS.find((value) => Object.keys(validateStep(value)).length > 0) ?? 4
      setStep(firstInvalid)
      return
    }
    publishMutation.mutate()
  }

  if (isBootstrapping || !isAuthenticated || statusQuery.isLoading || (isEditing && existingQuery.isLoading)) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (statusQuery.data?.accountStatus && statusQuery.data.accountStatus !== 'ACTIVE') {
    return <p className="text-sm text-destructive">{t('marketplace.sell.restricted')}</p>
  }

  if (isEditing && existingQuery.isError) {
    return <p className="text-sm text-destructive">{t('marketplace.detail.notFound')}</p>
  }

  const stepTitles: Record<Step, string> = {
    1: t('marketplace.sell.steps.photos'),
    2: t('marketplace.sell.steps.details'),
    3: t('marketplace.sell.steps.location'),
    4: t('marketplace.sell.steps.contact'),
  }

  const movingOutSales = (dashboardQuery.data?.movingOutSales ?? []).filter((sale) => sale.isActive || sale.id === form.movingOutSaleId)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton
        fallback={isEditing ? '/marketplace/my' : '/marketplace'}
        confirmMessage={dirty && !publishMutation.isSuccess ? t('common.discardChanges') : null}
      />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{isEditing ? t('marketplace.sell.editTitle') : t('marketplace.sell.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('marketplace.sell.subtitle')}</p>
      </div>

      <nav aria-label={t('marketplace.sell.progressLabel')}>
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((value) => {
            const complete = value < step
            const current = value === step
            return (
              <li key={value}>
                <button
                  type="button"
                  onClick={() => (value < step ? setStep(value) : goTo(value))}
                  aria-current={current ? 'step' : undefined}
                  className="flex w-full flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-all',
                      current && 'bg-primary text-primary-foreground ring-4 ring-primary/25',
                      complete && 'bg-primary text-primary-foreground',
                      !current && !complete && 'border-2 bg-background text-muted-foreground',
                    )}
                  >
                    {complete ? <Check className="size-4" aria-hidden /> : value}
                  </span>
                  <span className={cn('text-xs', current ? 'font-semibold' : 'text-muted-foreground')}>{stepTitles[value]}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('marketplace.sell.stepHeading', { step, title: stepTitles[step] })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 ? (
            <MarketplacePhotoUploader
              photos={form.images}
              coverIndex={form.coverIndex}
              error={errors.images}
              onChange={({ photos, coverIndex }) => {
                setForm((previous) => ({ ...previous, images: photos, coverIndex }))
                setDirty(true)
                setErrors((previous) => ({ ...previous, images: undefined }))
              }}
            />
          ) : null}

          {step === 2 ? (
            <>
              <Field id="listing-title" label={t('marketplace.fields.title')} error={errors.title}>
                <Input id="listing-title" maxLength={120} value={form.title} onChange={(event) => set('title', event.target.value)} placeholder={t('marketplace.sell.titlePlaceholder')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="listing-category" label={t('marketplace.fields.category')} error={errors.categoryId}>
                  <select
                    id="listing-category"
                    className={selectClassName}
                    value={form.categoryId}
                    onChange={(event) => {
                      setForm((previous) => ({ ...previous, categoryId: event.target.value, subcategoryId: '' }))
                      setErrors((previous) => ({ ...previous, categoryId: undefined, subcategoryId: undefined }))
                    }}
                  >
                    <option value="">{t('marketplace.sell.chooseCategory')}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryLabel(category, i18n.language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="listing-subcategory" label={t('marketplace.fields.subcategory')} error={errors.subcategoryId}>
                  <select
                    id="listing-subcategory"
                    className={selectClassName}
                    value={form.subcategoryId}
                    disabled={!selectedCategory || selectedCategory.children.length === 0}
                    onChange={(event) => set('subcategoryId', event.target.value)}
                  >
                    <option value="">
                      {selectedCategory && selectedCategory.children.length === 0 ? t('marketplace.sell.noSubcategory') : t('marketplace.sell.chooseSubcategory')}
                    </option>
                    {selectedCategory?.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {categoryLabel(child, i18n.language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="listing-price" label={t('marketplace.fields.price')} error={errors.price}>
                  <Input id="listing-price" type="number" min={0} step="100" inputMode="numeric" value={form.price} onChange={(event) => set('price', event.target.value)} />
                </Field>
                <Field id="listing-condition" label={t('marketplace.fields.condition')} error={errors.condition}>
                  <select id="listing-condition" className={selectClassName} value={form.condition} onChange={(event) => set('condition', event.target.value as ListingCondition)}>
                    <option value="">{t('marketplace.sell.chooseCondition')}</option>
                    {LISTING_CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>
                        {t(`marketplace.condition.${condition}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field id="listing-description" label={t('marketplace.fields.description')} error={errors.description}>
                <textarea
                  id="listing-description"
                  className={cn(textareaClassName, 'min-h-32')}
                  maxLength={4000}
                  value={form.description}
                  onChange={(event) => set('description', event.target.value)}
                  placeholder={t('marketplace.sell.descriptionPlaceholder')}
                />
              </Field>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="listing-township" label={t('marketplace.fields.township')} error={errors.cityId}>
                  <select id="listing-township" className={selectClassName} value={form.cityId} onChange={(event) => set('cityId', event.target.value)}>
                    <option value="">{t('marketplace.sell.chooseTownship')}</option>
                    {(townshipsQuery.data ?? []).map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="listing-area" label={t('marketplace.fields.area')}>
                  <Input id="listing-area" maxLength={200} value={form.locationDetail} onChange={(event) => set('locationDetail', event.target.value)} placeholder={t('marketplace.sell.areaPlaceholder')} />
                </Field>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">{t('marketplace.fields.pickup')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PICKUP_METHODS.map((method) => (
                    <label key={method} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" name="pickup" value={method} checked={form.pickupMethod === method} onChange={() => set('pickupMethod', method)} />
                      {t(`marketplace.pickup.${method}`)}
                    </label>
                  ))}
                </div>
                <FieldError message={errors.pickupMethod} />
              </fieldset>
              {movingOutSales.length > 0 ? (
                <Field id="listing-sale" label={t('marketplace.fields.movingOutSale')} hint={t('marketplace.sell.movingOutSaleHint')}>
                  <select id="listing-sale" className={selectClassName} value={form.movingOutSaleId} onChange={(event) => set('movingOutSaleId', event.target.value)}>
                    <option value="">{t('marketplace.sell.noMovingOutSale')}</option>
                    {movingOutSales.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        {sale.title}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </>
          ) : null}

          {step === 4 && contact ? (
            <>
              <p className="text-sm text-muted-foreground">{t('marketplace.sell.contactIntro')}</p>
              <div className="space-y-3">
                {(
                  [
                    { key: 'phone', show: 'showPhone', label: t('marketplace.contact.phone'), placeholder: '09xxxxxxxxx' },
                    { key: 'telegramUsername', show: 'showTelegram', label: t('marketplace.contact.telegramUsername'), placeholder: '@username' },
                    { key: 'viberNumber', show: 'showViber', label: t('marketplace.contact.viberNumber'), placeholder: '09xxxxxxxxx' },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-${row.key}`}>{row.label}</Label>
                      <Input
                        id={`contact-${row.key}`}
                        value={contact[row.key] ?? ''}
                        placeholder={row.placeholder}
                        onChange={(event) => {
                          setContact({ ...contact, [row.key]: event.target.value })
                          setErrors((previous) => ({ ...previous, contact: undefined }))
                        }}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm sm:pt-6">
                      <input
                        type="checkbox"
                        checked={form[row.show]}
                        onChange={(event) => {
                          set(row.show, event.target.checked)
                          setContact({ ...contact, [row.show]: true })
                          setErrors((previous) => ({ ...previous, contact: undefined }))
                        }}
                      />
                      {t('marketplace.sell.showButton')}
                    </label>
                  </div>
                ))}
                <FieldError message={errors.contact} />
                <p className="text-xs text-muted-foreground">{t('marketplace.sell.contactPrivacy')}</p>
              </div>

              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  {t('marketplace.policy.confirmTitle')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('marketplace.policy.confirmBody')}{' '}
                  <Link to="/marketplace/policy" target="_blank" className="text-primary underline-offset-4 hover:underline">
                    {t('marketplace.policy.readPolicy')}
                  </Link>
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={form.policyAccepted} onChange={(event) => set('policyAccepted', event.target.checked)} />
                  {t('marketplace.policy.checkbox')}
                </label>
                <FieldError message={errors.policyAccepted} />
              </div>
            </>
          ) : null}

          {publishMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {publishMutation.error instanceof ApiRequestError ? publishMutation.error.message : t('marketplace.sell.saveError')}
            </p>
          ) : null}

          <div className="flex justify-between gap-2 border-t pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((step - 1) as Step)}>
                {t('common.previous')}
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link to={isEditing ? '/marketplace/my' : '/marketplace'}>{t('common.cancel')}</Link>
              </Button>
            )}
            {step < 4 ? (
              <Button type="button" onClick={() => goTo((step + 1) as Step)}>
                {t('common.next')}
              </Button>
            ) : (
              <Button type="button" disabled={publishMutation.isPending} onClick={onPublish}>
                {publishMutation.isPending ? t('common.loading') : isEditing ? t('marketplace.sell.saveChanges') : t('marketplace.sell.publish')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
