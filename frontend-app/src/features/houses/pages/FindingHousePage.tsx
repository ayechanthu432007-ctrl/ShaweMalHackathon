import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { masterDataApi } from '@/features/master-data/api/master-data-api'
import { RecommendedHouses } from '@/features/recommendations/components/RecommendedHouses'

import { housesApi } from '../api/houses-api'
import { FeatureHouses } from '../components/FeatureHouses'
import { HouseCard } from '../components/HouseCard'
import { HouseFilterForm, type HouseFilterValues } from '../components/HouseFilterForm'

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
        <h1 className="text-3xl font-semibold tracking-tight">{t('houses.findingTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('houses.findingSubtitle')}</p>
      </div>

      <FeatureHouses />

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

      <RecommendedHouses />

      {housesQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

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
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={filters.page <= 1}
            onClick={() => setPage(filters.page - 1)}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('houses.pageStatus', { page: filters.page, total: housesQuery.data.totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={filters.page >= housesQuery.data.totalPages}
            onClick={() => setPage(filters.page + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
