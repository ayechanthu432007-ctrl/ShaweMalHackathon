import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SingleImageUploadField } from '@/components/uploads/SingleImageUploadField'
import { housesApi } from '@/features/houses/api/houses-api'
import { MarketplaceDialog } from '@/features/marketplace/components/MarketplaceDialog'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { ApiRequestError, refreshAccessToken } from '@/lib/api/client'

import { roommatesApi } from '../api/roommates-api'
import { RoommateCard } from '../components/RoommateCard'
import {
  defaultRoommatePostFormValues,
  ROOMMATE_HOBBY_FLAGS,
  ROOMMATE_INTEREST_FLAGS,
  roommatePostToFormValues,
  validateRoommatePostForm,
  type RoommatePostFormValues,
} from '../schemas/roommate-post-schema'
import type { RoommateCreateInput, RoommateGender, RoommateListFilters, RoommatePost } from '../types'

export function FindingRoommatesPage() {
  const { t } = useTranslation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<RoommateListFilters>({
    gender: '',
    occupationId: '',
    cityId: '',
    stateId: '',
  })
  const [appliedFilters, setAppliedFilters] = useState<RoommateListFilters>({})
  const [showPostForm, setShowPostForm] = useState(false)
  const [editingPost, setEditingPost] = useState<RoommatePost | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoommatePost | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const occupationsQuery = useQuery({
    queryKey: ['master-data', 'occupations'],
    queryFn: () => masterDataApi.list('occupations'),
  })

  const citiesQuery = useQuery({
    queryKey: ['master-data', 'cities'],
    queryFn: () => masterDataApi.list('cities'),
  })

  const statesQuery = useQuery({
    queryKey: ['master-data', 'states'],
    queryFn: () => masterDataApi.list('states'),
  })

  const roommatesQuery = useQuery({
    // Matches are personal, so the list is kept per account and reloads on sign-in and sign-out.
    queryKey: ['roommates', appliedFilters, user?.id ?? 'guest'],
    // Wait until it is known who is looking, so the list is requested once, already personalised.
    enabled: !isBootstrapping,
    queryFn: async () => {
      const result = await roommatesApi.list(appliedFilters)
      // An expired session is served the plain list; renew it once so the matches come back.
      if (isAuthenticated && !result.viewer?.signedIn && (await refreshAccessToken())) {
        return roommatesApi.list(appliedFilters)
      }
      return result
    },
    // Keep the cards on screen while the list reloads (new filters, or the session becoming known).
    placeholderData: (previous) => previous,
  })

  const housesQuery = useQuery({
    queryKey: ['houses', 'roommate-select'],
    enabled: isAuthenticated && showPostForm,
    queryFn: () => housesApi.list({ page: 1, pageSize: 50 }),
  })

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoommatePostFormValues>({
    defaultValues: defaultRoommatePostFormValues(),
  })

  const closePostForm = () => {
    reset(defaultRoommatePostFormValues())
    setEditingPost(null)
    setShowPostForm(false)
    setFormError(null)
  }

  const createMutation = useMutation({
    mutationFn: roommatesApi.create,
    onSuccess: async () => {
      setSuccessMessage(t('roommates.postSuccess'))
      closePostForm()
      await queryClient.invalidateQueries({ queryKey: ['roommates'] })
    },
    onError: (error) => {
      setFormError(error instanceof ApiRequestError ? error.message : t('roommates.postFailed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RoommateCreateInput }) => roommatesApi.update(id, input),
    onSuccess: async () => {
      setSuccessMessage(t('roommates.updateSuccess'))
      closePostForm()
      await queryClient.invalidateQueries({ queryKey: ['roommates'] })
    },
    onError: (error) => {
      setFormError(error instanceof ApiRequestError ? error.message : t('roommates.updateFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: roommatesApi.remove,
    onSuccess: async (_data, id) => {
      setSuccessMessage(t('roommates.deleteSuccess'))
      setDeleteTarget(null)
      if (editingPost?.id === id) closePostForm()
      await queryClient.invalidateQueries({ queryKey: ['roommates'] })
    },
    onError: (error) => {
      setDeleteError(error instanceof ApiRequestError ? error.message : t('roommates.deleteFailed'))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const onEdit = (post: RoommatePost) => {
    reset(roommatePostToFormValues(post))
    setEditingPost(post)
    setFormError(null)
    setSuccessMessage(null)
    setShowPostForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const occupationNameById = useMemo(() => {
    return new Map((occupationsQuery.data?.items ?? []).map((item) => [item.id, item.name]))
  }, [occupationsQuery.data?.items])

  const filteredCities = useMemo(() => {
    const items = citiesQuery.data?.items ?? []
    if (!filters.stateId) return items
    return items.filter((city) => !city.stateId || city.stateId === filters.stateId)
  }, [citiesQuery.data?.items, filters.stateId])

  const isLoadingFilterOptions =
    occupationsQuery.isLoading || citiesQuery.isLoading || statesQuery.isLoading

  const onPost = handleSubmit(async (values) => {
    const validationErrors = validateRoommatePostForm(values, t)
    const keys = Object.keys(validationErrors) as Array<keyof RoommatePostFormValues>
    if (keys.length > 0) {
      keys.forEach((key) => {
        const message = validationErrors[key]
        if (message) setError(key, { type: 'validate', message })
      })
      return
    }

    setFormError(null)
    setSuccessMessage(null)
    const input: RoommateCreateInput = {
      houseId: values.houseId,
      title: values.title.trim(),
      budgetCostSharing: values.budgetCostSharing.trim(),
      gender: values.gender,
      occupationId: values.occupationId,
      isLgbtqFriendly: values.isLgbtqFriendly,
      isCannabisFriendly: values.isCannabisFriendly,
      isSmokingFriendly: values.isSmokingFriendly,
      isNoSmoking: values.isNoSmoking,
      isCatFriendly: values.isCatFriendly,
      isDogFriendly: values.isDogFriendly,
      isAlcoholFriendly: values.isAlcoholFriendly,
      likesNightOut: values.likesNightOut,
      likesHangoutEveryday: values.likesHangoutEveryday,
      hobbyPlayingGame: values.hobbyPlayingGame,
      hobbyWatchingMovies: values.hobbyWatchingMovies,
      hobbySinging: values.hobbySinging,
      hobbyPlayingFootball: values.hobbyPlayingFootball,
      hobbyRunning: values.hobbyRunning,
      hobbyCooking: values.hobbyCooking,
      hobbyReading: values.hobbyReading,
      hobbyFoodie: values.hobbyFoodie,
      hobbyChillWithOthers: values.hobbyChillWithOthers,
      hobbyRelaxSilent: values.hobbyRelaxSilent,
      hobbyPlayingGym: values.hobbyPlayingGym,
      photos: [values.photo1, values.photo2].filter((path) => path.trim().length > 0),
    }

    // Failures are reported through each mutation's onError.
    try {
      if (editingPost) {
        await updateMutation.mutateAsync({ id: editingPost.id, input })
      } else {
        await createMutation.mutateAsync(input)
      }
    } catch {
      return
    }
  })

  const houseOptions = housesQuery.data?.items ?? []
  const occupationOptions = occupationsQuery.data?.items ?? []
  // Keep the edited post's own house/occupation selectable even when the loaded lists don't include them.
  const editingHouse =
    editingPost?.house && !houseOptions.some((house) => house.id === editingPost.house?.id) ? editingPost.house : null
  const editingOccupation =
    editingPost?.occupation && !occupationOptions.some((item) => item.id === editingPost.occupation?.id)
      ? editingPost.occupation
      : null

  const posts = roommatesQuery.data?.items ?? []
  const viewer = roommatesQuery.data?.viewer ?? { signedIn: false, hasPreferences: false }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('nav.findingRoommates')}</h1>
          <p className="text-sm text-muted-foreground">{t('roommates.subtitle')}</p>
        </div>
        {isAuthenticated ? (
          <Button type="button" onClick={() => (showPostForm ? closePostForm() : setShowPostForm(true))}>
            {showPostForm ? t('common.cancel') : t('roommates.postAction')}
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/sign-in">{t('roommates.signInToPost')}</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-3 lg:flex-row lg:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              setAppliedFilters({
                gender: (filters.gender || undefined) as RoommateGender | undefined,
                occupationId: filters.occupationId || undefined,
                cityId: filters.cityId || undefined,
                stateId: filters.stateId || undefined,
              })
            }}
          >
            <Field label={t('roommates.gender')} htmlFor="roommate-filter-gender" className="min-w-0 lg:flex-1">
              <select
                id="roommate-filter-gender"
                className={selectClassName}
                value={filters.gender ?? ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, gender: e.target.value as RoommateGender | '' }))}
              >
                <option value="">{t('houses.filters.any')}</option>
                <option value="MALE">{t('roommates.genderMale')}</option>
                <option value="FEMALE">{t('roommates.genderFemale')}</option>
                <option value="ANY">{t('roommates.genderAny')}</option>
              </select>
            </Field>
            <Field label={t('roommates.occupation')} htmlFor="roommate-filter-occupation" className="min-w-0 lg:flex-1">
              <select
                id="roommate-filter-occupation"
                className={selectClassName}
                value={filters.occupationId ?? ''}
                disabled={isLoadingFilterOptions}
                onChange={(e) => setFilters((prev) => ({ ...prev, occupationId: e.target.value }))}
              >
                <option value="">{t('houses.filters.any')}</option>
                {(occupationsQuery.data?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('agent.state')} htmlFor="roommate-filter-state" className="min-w-0 lg:flex-1">
              <select
                id="roommate-filter-state"
                className={selectClassName}
                value={filters.stateId ?? ''}
                disabled={isLoadingFilterOptions}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    stateId: e.target.value,
                    cityId: '',
                  }))
                }
              >
                <option value="">{t('houses.filters.any')}</option>
                {(statesQuery.data?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('houses.filters.city')} htmlFor="roommate-filter-city" className="min-w-0 lg:flex-1">
              <select
                id="roommate-filter-city"
                className={selectClassName}
                value={filters.cityId ?? ''}
                disabled={isLoadingFilterOptions}
                onChange={(e) => setFilters((prev) => ({ ...prev, cityId: e.target.value }))}
              >
                <option value="">{t('houses.filters.any')}</option>
                {filteredCities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex shrink-0 gap-2">
              <Button type="submit">{t('houses.filters.apply')}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilters({
                    gender: '',
                    occupationId: '',
                    cityId: '',
                    stateId: '',
                  })
                  setAppliedFilters({})
                }}
              >
                {t('common.clear')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showPostForm && isAuthenticated ? (
        <Card key={editingPost?.id ?? 'new'}>
          <CardHeader>
            <CardTitle className="text-lg">{editingPost ? t('roommates.editTitle') : t('roommates.postTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onPost} noValidate>
              <Field label={t('roommates.house')} error={errors.houseId?.message} className="sm:col-span-2">
                <select className={selectClassName} {...register('houseId')}>
                  <option value="">{t('houses.filters.any')}</option>
                  {editingHouse ? <option value={editingHouse.id}>{editingHouse.title}</option> : null}
                  {houseOptions.map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('roommates.postTitleField')} error={errors.title?.message} className="sm:col-span-2">
                <Input {...register('title')} />
              </Field>
              <Field label={t('roommates.budget')} error={errors.budgetCostSharing?.message} className="sm:col-span-2">
                <Input {...register('budgetCostSharing')} />
              </Field>
              <Field label={t('roommates.gender')} error={errors.gender?.message}>
                <select className={selectClassName} {...register('gender')}>
                  <option value="MALE">{t('roommates.genderMale')}</option>
                  <option value="FEMALE">{t('roommates.genderFemale')}</option>
                  <option value="ANY">{t('roommates.genderAny')}</option>
                </select>
              </Field>
              <Field label={t('roommates.occupation')} error={errors.occupationId?.message}>
                <select className={selectClassName} {...register('occupationId')}>
                  <option value="">{t('houses.filters.any')}</option>
                  {editingOccupation ? <option value={editingOccupation.id}>{editingOccupation.name}</option> : null}
                  {occupationOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium">{t('roommates.interests')}</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ROOMMATE_INTEREST_FLAGS.map((flag) => (
                    <label key={flag} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...register(flag)} />
                      {t(`roommates.flags.${flag}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium">{t('roommates.hobbies')}</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ROOMMATE_HOBBY_FLAGS.map((flag) => (
                    <label key={flag} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...register(flag)} />
                      {t(`roommates.flags.${flag}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium">{t('roommates.photos')}</legend>
                <p className="text-xs text-muted-foreground">{t('roommates.photosHint')}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(['photo1', 'photo2'] as const).map((field, index) => (
                    <div key={field} className="space-y-2 rounded-md border border-input p-3">
                      <p className="text-sm font-medium">
                        {t('roommates.photoLabel', { index: index + 1 })}{' '}
                        <span className={index === 0 ? 'text-destructive' : 'font-normal text-muted-foreground'}>
                          ({index === 0 ? t('roommates.photoRequiredTag') : t('roommates.photoOptionalTag')})
                        </span>
                      </p>
                      <SingleImageUploadField
                        path={watch(field)}
                        category="profile"
                        disabled={isSaving}
                        error={errors[field]?.message}
                        onChange={(nextPath) => {
                          setValue(field, nextPath, { shouldDirty: true })
                          if (nextPath) clearErrors(field)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              {formError ? <p className="text-sm text-destructive sm:col-span-2">{formError}</p> : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={isSubmitting || isSaving}>
                  {isSubmitting || isSaving
                    ? t('common.loading')
                    : editingPost
                      ? t('roommates.saveChanges')
                      : t('roommates.submitPost')}
                </Button>
                {editingPost ? (
                  <Button type="button" variant="outline" disabled={isSaving} onClick={closePostForm}>
                    {t('common.cancel')}
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {successMessage ? <p className="text-sm text-primary">{successMessage}</p> : null}

      <section className="space-y-4" aria-labelledby="roommate-list-title">
        <div>
          <h2 id="roommate-list-title" className="text-xl font-semibold tracking-tight">
            {t('roommates.listTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{viewer.signedIn ? t('roommates.listSubtitleRanked') : t('roommates.listSubtitle')}</p>
        </div>

        {!isAuthenticated ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t('match.roommates.signIn')}</p>
            <Button asChild size="sm">
              <Link to="/sign-in" state={{ from: '/finding-roommates' }}>
                {t('nav.signIn')}
              </Link>
            </Button>
          </div>
        ) : null}

        {viewer.signedIn && !viewer.hasPreferences ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t('roommates.completePreferences')}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/profile#housing-preferences">{t('match.setPreferences')}</Link>
            </Button>
          </div>
        ) : null}

        {viewer.signedIn && viewer.hasPreferences ? (
          <p className="text-sm">
            <Link to="/profile#housing-preferences" className="font-medium text-primary underline-offset-4 hover:underline">
              {t('match.setPreferences')}
            </Link>
          </p>
        ) : null}

        {roommatesQuery.isLoading || isBootstrapping ? <LoadingState /> : null}
        {roommatesQuery.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{t('roommates.loadError')}</p>
            <Button type="button" variant="outline" onClick={() => void roommatesQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : null}
        {!roommatesQuery.isLoading && !isBootstrapping && !roommatesQuery.isError && posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('roommates.empty')}</p>
        ) : null}

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((item) => (
            <li key={item.id}>
              <RoommateCard
                post={item}
                viewer={viewer}
                isOwner={Boolean(user?.id && item.user?.id === user.id)}
                occupationName={item.occupation?.name ?? occupationNameById.get(item.occupation?.id ?? '') ?? t('roommates.occupationUnknown')}
                onEdit={() => onEdit(item)}
                onDelete={() => {
                  setDeleteError(null)
                  setDeleteTarget(item)
                }}
              />
            </li>
          ))}
        </ul>

        {viewer.signedIn && posts.some((item) => item.match) ? <p className="text-xs text-muted-foreground">{t('match.disclaimer')}</p> : null}
      </section>

      <MarketplaceDialog
        open={deleteTarget !== null}
        title={t('roommates.deleteConfirmTitle')}
        description={t('roommates.deleteConfirmBody', { title: deleteTarget?.title ?? '' })}
        icon={<Trash2 className="size-5" aria-hidden />}
        tone="destructive"
        busy={deleteMutation.isPending}
        onDismiss={() => setDeleteTarget(null)}
      >
        <div className="space-y-3">
          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
            >
              {deleteMutation.isPending ? t('common.loading') : t('roommates.deleteAction')}
            </Button>
          </div>
        </div>
      </MarketplaceDialog>
    </div>
  )
}

function Field({
  label,
  error,
  className,
  htmlFor,
  children,
}: {
  label: string
  error?: string
  className?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
