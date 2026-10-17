import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'

import { CardGridSkeleton } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { RecommendedHouses } from '@/features/recommendations/components/RecommendedHouses'

import { housesApi } from '../api/houses-api'
import { FeatureHouses } from '../components/FeatureHouses'
import { HouseCard } from '../components/HouseCard'
import { HouseFilterForm, type HouseFilterValues } from '../components/HouseFilterForm'
import { HOUSING_DEMO_FILTERS, isHousingDemoAccount } from '../lib/housing-demo'

function parseNumber(value: string | null): number | undefined {
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function FindingHousePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => ({
      city: searchParams.get('city') ?? '',
      type: searchParams.get('type') ?? '',
      minBudget: searchParams.get('minBudget') ?? '',
      maxBudget: searchParams.get('maxBudget') ?? '',
      page: Number(searchParams.get('page') ?? '1') || 1,
    }),
    [searchParams],
  )

  const citiesQuery = useQuery({
    queryKey: ['master-data', 'cities'],
    queryFn: () => masterDataApi.list('cities'),
  })

  const propertyTypesQuery = useQuery({
    queryKey: ['master-data', 'property-types'],
    queryFn: () => masterDataApi.list('property-types'),
  })

  const housesQuery = useQuery({
    queryKey: ['houses', filters],
    queryFn: () =>
      housesApi.list({
        city: filters.city || undefined,
        type: filters.type || undefined,
        minBudget: parseNumber(filters.minBudget),
        maxBudget: parseNumber(filters.maxBudget),
        page: filters.page,
        pageSize: 12,
      }),
  })

  // Demo accounts only: when the page opens with no filters in its address, select the demo city
  // and property type once (only if they exist in the lists). Budgets stay empty.
  const { user } = useAuth()
  const demoApplied = useRef(false)
  const cityNames = citiesQuery.data?.items
  const typeNames = propertyTypesQuery.data?.items
  useEffect(() => {
    if (demoApplied.current || !isHousingDemoAccount(user) || !cityNames || !typeNames) return
    demoApplied.current = true
    if (searchParams.toString()) return
    const next = new URLSearchParams()
    if (cityNames.some((city) => city.name === HOUSING_DEMO_FILTERS.city)) next.set('city', HOUSING_DEMO_FILTERS.city)
    if (typeNames.some((type) => type.name === HOUSING_DEMO_FILTERS.type)) next.set('type', HOUSING_DEMO_FILTERS.type)
    if (next.toString()) setSearchParams(next, { replace: true })
  }, [cityNames, searchParams, setSearchParams, typeNames, user])

  const applyFilters = (values: HouseFilterValues) => {
    const next = new URLSearchParams()
    if (values.city) next.set('city', values.city)
    if (values.type) next.set('type', values.type)
    if (values.minBudget) next.set('minBudget', values.minBudget)
    if (values.maxBudget) next.set('maxBudget', values.maxBudget)
    next.set('page', '1')
    setSearchParams(next)
  }

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('houses.findingTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('houses.findingSubtitle')}</p>
      </div>

      <FeatureHouses />

      <RecommendedHouses />

      <HouseFilterForm
        defaultValues={{
          city: filters.city,
          type: filters.type,
          minBudget: filters.minBudget,
          maxBudget: filters.maxBudget,
        }}
        cities={citiesQuery.data?.items ?? []}
        propertyTypes={propertyTypesQuery.data?.items ?? []}
        isLoadingOptions={citiesQuery.isLoading || propertyTypesQuery.isLoading}
        onSubmit={applyFilters}
      />

      {housesQuery.isLoading ? <CardGridSkeleton count={6} /> : null}

      {housesQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t('houses.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void housesQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {!housesQuery.isLoading && !housesQuery.isError && (housesQuery.data?.items.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t('houses.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('houses.emptyHint')}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {housesQuery.data?.items.map((house) => (
          <HouseCard key={house.id} house={house} />
        ))}
      </div>

      {housesQuery.data && housesQuery.data.totalPages > 1 ? (
        <Pagination
          page={filters.page}
          totalPages={housesQuery.data.totalPages}
          onPageChange={setPage}
          status={t('houses.pageStatus', { page: filters.page, total: housesQuery.data.totalPages })}
        />
      ) : null}
    </section>
  )
}
