import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { CardGridSkeleton } from '@/components/common/PageStates'
import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'

import { marketplaceApi } from '../api/marketplace-api'
import { ListingCard, ListingGrid } from '../components/ListingCard'
import { MarketplaceSearchBar } from '../components/MarketplaceSearchBar'
import { useMarketplaceCategories, useTownships } from '../hooks/useMarketplaceData'
import { categoryLabel } from '../lib/marketplace-format'
import { LISTING_CONDITIONS, type ListingCondition, type ListingSort } from '../types'

const FILTER_KEYS = ['categoryId', 'subcategoryId', 'condition', 'cityId', 'minPrice', 'maxPrice', 'sort'] as const
type FilterKey = (typeof FILTER_KEYS)[number]
type FilterValues = Record<FilterKey, string>

function parsePrice(value: string | null) {
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function MarketplaceSearchPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const categoriesQuery = useMarketplaceCategories()
  const townshipsQuery = useTownships()

  const q = searchParams.get('q') ?? ''
  const page = Number(searchParams.get('page') ?? '1') || 1
  const current = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? ''])) as FilterValues,
    [searchParams],
  )
  const [draft, setDraft] = useState<FilterValues>(current)

  const listingsQuery = useQuery({
    queryKey: ['marketplace', 'search', q, current, page],
    queryFn: () =>
      marketplaceApi.search({
        q: q || undefined,
        categoryId: current.categoryId || undefined,
        subcategoryId: current.subcategoryId || undefined,
        condition: (current.condition || undefined) as ListingCondition | undefined,
        cityId: current.cityId || undefined,
        minPrice: parsePrice(current.minPrice),
        maxPrice: parsePrice(current.maxPrice),
        sort: (current.sort || 'newest') as ListingSort,
        page,
        pageSize: 24,
      }),
  })

  const categories = categoriesQuery.data ?? []
  const draftCategory = categories.find((category) => category.id === draft.categoryId)
  const activeCategory = categories.find((category) => category.id === current.categoryId)

  const writeParams = (values: FilterValues, nextPage = 1) => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    for (const key of FILTER_KEYS) {
      if (values[key]) next.set(key, values[key])
    }
    if (nextPage > 1) next.set('page', String(nextPage))
    setSearchParams(next)
  }

  const onApply = (event: FormEvent) => {
    event.preventDefault()
    writeParams(draft)
    setFiltersOpen(false)
  }

  const onReset = () => {
    const empty = Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])) as FilterValues
    setDraft(empty)
    writeParams(empty)
  }

  const setDraftValue = (key: FilterKey, value: string) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'categoryId' ? { subcategoryId: '' } : {}),
    }))
  }

  const data = listingsQuery.data

  return (
    <div className="space-y-6">
      {/* Filters live in the URL, so this goes straight to the marketplace instead of undoing the last filter. */}
      <BackLink to="/marketplace" label={t('marketplace.backToMarketplace')} />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {q
            ? t('marketplace.search.resultsFor', { query: q })
            : activeCategory
              ? categoryLabel(activeCategory, i18n.language)
              : t('marketplace.search.allItems')}
        </h1>
        <MarketplaceSearchBar key={q} defaultQuery={q} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {data ? t('marketplace.search.count', { count: data.total }) : ' '}
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="sr-only">
            {t('marketplace.search.sort')}
          </Label>
          <select
            id="sort"
            className={`${selectClassName} w-auto`}
            value={current.sort || 'newest'}
            onChange={(event) => {
              const next = { ...current, sort: event.target.value === 'newest' ? '' : event.target.value }
              setDraft(next)
              writeParams(next)
            }}
          >
            <option value="newest">{t('marketplace.search.sortNewest')}</option>
            <option value="price_asc">{t('marketplace.search.sortPriceAsc')}</option>
            <option value="price_desc">{t('marketplace.search.sortPriceDesc')}</option>
          </select>
          <Button
            type="button"
            variant="outline"
            aria-expanded={filtersOpen}
            aria-controls="marketplace-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden />
            {t('marketplace.search.filters')}
          </Button>
        </div>
      </div>

      {filtersOpen ? (
        <form id="marketplace-filters" className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onApply}>
          <div className="space-y-1.5">
            <Label htmlFor="filter-category">{t('marketplace.fields.category')}</Label>
            <select id="filter-category" className={selectClassName} value={draft.categoryId} onChange={(event) => setDraftValue('categoryId', event.target.value)}>
              <option value="">{t('marketplace.search.any')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-subcategory">{t('marketplace.fields.subcategory')}</Label>
            <select
              id="filter-subcategory"
              className={selectClassName}
              value={draft.subcategoryId}
              disabled={!draftCategory || draftCategory.children.length === 0}
              onChange={(event) => setDraftValue('subcategoryId', event.target.value)}
            >
              <option value="">{t('marketplace.search.any')}</option>
              {draftCategory?.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {categoryLabel(child, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-condition">{t('marketplace.fields.condition')}</Label>
            <select id="filter-condition" className={selectClassName} value={draft.condition} onChange={(event) => setDraftValue('condition', event.target.value)}>
              <option value="">{t('marketplace.search.any')}</option>
              {LISTING_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {t(`marketplace.condition.${condition}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-township">{t('marketplace.fields.township')}</Label>
            <select id="filter-township" className={selectClassName} value={draft.cityId} onChange={(event) => setDraftValue('cityId', event.target.value)}>
              <option value="">{t('marketplace.search.any')}</option>
              {(townshipsQuery.data ?? []).map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-min">{t('marketplace.search.minPrice')}</Label>
            <Input id="filter-min" type="number" min={0} inputMode="numeric" value={draft.minPrice} onChange={(event) => setDraftValue('minPrice', event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-max">{t('marketplace.search.maxPrice')}</Label>
            <Input id="filter-max" type="number" min={0} inputMode="numeric" value={draft.maxPrice} onChange={(event) => setDraftValue('maxPrice', event.target.value)} />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            <Button type="button" variant="ghost" onClick={onReset}>
              {t('common.clear')}
            </Button>
            <Button type="submit">{t('marketplace.search.apply')}</Button>
          </div>
        </form>
      ) : null}

      {listingsQuery.isLoading ? <CardGridSkeleton count={8} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" /> : null}

      {listingsQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t('marketplace.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void listingsQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t('marketplace.search.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('marketplace.search.emptyHint')}</p>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <ListingGrid>
          {data.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ListingGrid>
      ) : null}

      {data && data.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          onPageChange={(next) => writeParams(current, next)}
          status={t('marketplace.search.pageStatus', { page, total: data.totalPages })}
        />
      ) : null}
    </div>
  )
}
