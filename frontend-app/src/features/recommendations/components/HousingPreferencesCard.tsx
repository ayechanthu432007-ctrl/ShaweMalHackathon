import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { masterDataApi } from '@/features/master-data/api/master-data-api'

import { recommendationsApi, type HousingPreferencesInput, type HousingPreferencesResponse } from '../api/recommendations-api'

/** Lifestyle questions, each answered from a short fixed list (or left blank). */
const CHOICES = {
  roomArrangement: ['PRIVATE', 'SHARED', 'ANY'],
  cleanliness: ['RELAXED', 'TIDY', 'VERY_TIDY'],
  sleepSchedule: ['EARLY', 'LATE', 'FLEXIBLE'],
  smoking: ['NON_SMOKER', 'SMOKER', 'ANY'],
  noiseTolerance: ['LOW', 'MEDIUM', 'HIGH'],
  socialLevel: ['QUIET', 'BALANCED', 'SOCIAL'],
  guests: ['RARELY', 'SOMETIMES', 'OFTEN'],
} as const

type ChoiceField = keyof typeof CHOICES
const CHOICE_FIELDS = Object.keys(CHOICES) as ChoiceField[]
const LEASE_OPTIONS = [3, 6, 12, 24]

type FormValues = Record<ChoiceField, string> & {
  occupationId: string
  budgetMin: string
  budgetMax: string
  preferredCityId: string
  propertyTypeId: string
  bedroomsMin: string
  wantsFurnished: boolean
  needsInternet: boolean
  needsQuiet: boolean
  moveInDate: string
  leaseMonths: string
  sharesChores: string
  visibleToAgents: boolean
}

const toFormValues = (data: HousingPreferencesResponse | undefined): FormValues => {
  const p = data?.preferences
  return {
    occupationId: data?.occupation?.id ?? '',
    budgetMin: p?.budgetMin != null ? String(p.budgetMin) : '',
    budgetMax: p?.budgetMax != null ? String(p.budgetMax) : '',
    preferredCityId: p?.preferredCity?.id ?? '',
    propertyTypeId: p?.propertyType?.id ?? '',
    bedroomsMin: p?.bedroomsMin != null ? String(p.bedroomsMin) : '',
    wantsFurnished: p?.wantsFurnished === true,
    needsInternet: p?.needsInternet === true,
    needsQuiet: p?.needsQuiet === true,
    moveInDate: p?.moveInDate ? p.moveInDate.slice(0, 10) : '',
    leaseMonths: p?.leaseMonths != null ? String(p.leaseMonths) : '',
    roomArrangement: p?.roomArrangement ?? '',
    cleanliness: p?.cleanliness ?? '',
    sleepSchedule: p?.sleepSchedule ?? '',
    smoking: p?.smoking ?? '',
    noiseTolerance: p?.noiseTolerance ?? '',
    socialLevel: p?.socialLevel ?? '',
    guests: p?.guests ?? '',
    sharesChores: p?.sharesChores == null ? '' : p.sharesChores ? 'yes' : 'no',
    visibleToAgents: p?.visibleToAgents === true,
  }
}

const toNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value))
const toText = (value: string): string | null => (value === '' ? null : value)

const toInput = (values: FormValues): HousingPreferencesInput => ({
  occupationId: toText(values.occupationId),
  budgetMin: toNumber(values.budgetMin),
  budgetMax: toNumber(values.budgetMax),
  preferredCityId: toText(values.preferredCityId),
  propertyTypeId: toText(values.propertyTypeId),
  bedroomsMin: toNumber(values.bedroomsMin),
  // An unticked box means "no preference", not "must not have it".
  wantsFurnished: values.wantsFurnished ? true : null,
  needsInternet: values.needsInternet ? true : null,
  needsQuiet: values.needsQuiet ? true : null,
  moveInDate: toText(values.moveInDate),
  leaseMonths: toNumber(values.leaseMonths),
  roomArrangement: toText(values.roomArrangement),
  cleanliness: toText(values.cleanliness),
  sleepSchedule: toText(values.sleepSchedule),
  smoking: toText(values.smoking),
  noiseTolerance: toText(values.noiseTolerance),
  socialLevel: toText(values.socialLevel),
  guests: toText(values.guests),
  sharesChores: values.sharesChores === '' ? null : values.sharesChores === 'yes',
  visibleToAgents: values.visibleToAgents,
})

/** Where a person says what they are looking for; every recommendation is calculated from this. */
export function HousingPreferencesCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null)

  const preferencesQuery = useQuery({ queryKey: ['housing-preferences'], queryFn: () => recommendationsApi.getPreferences() })
  const occupationsQuery = useQuery({ queryKey: ['master-data', 'occupations'], queryFn: () => masterDataApi.list('occupations') })
  const citiesQuery = useQuery({ queryKey: ['master-data', 'cities'], queryFn: () => masterDataApi.list('cities') })
  const propertyTypesQuery = useQuery({ queryKey: ['master-data', 'property-types'], queryFn: () => masterDataApi.list('property-types') })

  const { register, handleSubmit, reset, setError, formState } = useForm<FormValues>({ defaultValues: toFormValues(undefined) })

  useEffect(() => {
    if (preferencesQuery.data) reset(toFormValues(preferencesQuery.data))
  }, [preferencesQuery.data, reset])

  const saveMutation = useMutation({
    mutationFn: (input: HousingPreferencesInput) => recommendationsApi.savePreferences(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['housing-preferences'], data)
      // Every recommendation depends on these answers, so they are all recalculated.
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      void queryClient.invalidateQueries({ queryKey: ['roommates'] })
      setStatus({ kind: 'saved', message: t('match.preferences.saved') })
    },
    onError: () => setStatus({ kind: 'error', message: t('match.preferences.saveError') }),
  })

  const onSubmit = handleSubmit((values) => {
    setStatus(null)
    const min = toNumber(values.budgetMin)
    const max = toNumber(values.budgetMax)
    if (min !== null && max !== null && min > max) {
      setError('budgetMax', { type: 'validate', message: t('match.preferences.budgetRange') })
      return
    }
    saveMutation.mutate(toInput(values))
  })

  const options = (items: Array<{ id: string; name: string }> | undefined) =>
    (items ?? []).map((item) => (
      <option key={item.id} value={item.id}>
        {item.name}
      </option>
    ))

  return (
    <Card id="housing-preferences" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-lg">{t('match.preferences.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('match.preferences.intro')}</p>
      </CardHeader>
      <CardContent>
        {preferencesQuery.isLoading ? <LoadingState /> : null}
        {preferencesQuery.isError ? <p className="text-sm text-destructive">{t('match.preferences.loadError')}</p> : null}

        {preferencesQuery.data ? (
          <form className="space-y-6" onSubmit={onSubmit} noValidate>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">{t('match.preferences.homeSection')}</legend>
              <div className="space-y-2">
                <Label htmlFor="pref-occupation">{t('auth.occupation')}</Label>
                <select id="pref-occupation" className={selectClassName} {...register('occupationId')}>
                  <option value="">{t('match.preferences.notSet')}</option>
                  {options(occupationsQuery.data?.items)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-city">{t('match.preferences.city')}</Label>
                <select id="pref-city" className={selectClassName} {...register('preferredCityId')}>
                  <option value="">{t('match.preferences.noPreference')}</option>
                  {options(citiesQuery.data?.items)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-budget-min">{t('match.preferences.budgetMin')}</Label>
                <Input id="pref-budget-min" type="number" min={0} step={10000} inputMode="numeric" {...register('budgetMin')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-budget-max">{t('match.preferences.budgetMax')}</Label>
                <Input id="pref-budget-max" type="number" min={0} step={10000} inputMode="numeric" {...register('budgetMax')} />
                {formState.errors.budgetMax ? <p className="text-sm text-destructive">{formState.errors.budgetMax.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-type">{t('match.preferences.propertyType')}</Label>
                <select id="pref-type" className={selectClassName} {...register('propertyTypeId')}>
                  <option value="">{t('match.preferences.noPreference')}</option>
                  {options(propertyTypesQuery.data?.items)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-bedrooms">{t('match.preferences.bedroomsMin')}</Label>
                <Input id="pref-bedrooms" type="number" min={0} max={20} inputMode="numeric" {...register('bedroomsMin')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-move-in">{t('match.preferences.moveInDate')}</Label>
                <Input id="pref-move-in" type="date" {...register('moveInDate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-lease">{t('match.preferences.leaseMonths')}</Label>
                <select id="pref-lease" className={selectClassName} {...register('leaseMonths')}>
                  <option value="">{t('match.preferences.noPreference')}</option>
                  {LEASE_OPTIONS.map((months) => (
                    <option key={months} value={months}>
                      {t('match.months', { count: months })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
                {(['wantsFurnished', 'needsInternet', 'needsQuiet'] as const).map((field) => (
                  <label key={field} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register(field)} />
                    {t(`match.preferences.${field}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">{t('match.preferences.lifestyleSection')}</legend>
              {CHOICE_FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`pref-${field}`}>{t(`match.preferences.${field}`)}</Label>
                  <select id={`pref-${field}`} className={selectClassName} {...register(field)}>
                    <option value="">{t('match.preferences.notSet')}</option>
                    {CHOICES[field].map((value) => (
                      <option key={value} value={value}>
                        {t(`match.choices.${field}.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="pref-chores">{t('match.preferences.sharesChores')}</Label>
                <select id="pref-chores" className={selectClassName} {...register('sharesChores')}>
                  <option value="">{t('match.preferences.notSet')}</option>
                  <option value="yes">{t('match.preferences.yes')}</option>
                  <option value="no">{t('match.preferences.no')}</option>
                </select>
              </div>
            </fieldset>

            <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <input type="checkbox" className="mt-1" {...register('visibleToAgents')} />
              <span>
                <span className="font-medium">{t('match.preferences.visibleToAgents')}</span>
                <span className="mt-0.5 block text-muted-foreground">{t('match.preferences.visibleToAgentsHelp')}</span>
              </span>
            </label>

            {status ? (
              <p className={status.kind === 'saved' ? 'text-sm text-primary' : 'text-sm text-destructive'} role="status">
                {status.message}
              </p>
            ) : null}
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.loading') : t('match.preferences.save')}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
