import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatMmk } from '@/lib/format'

import type { HouseFilterValues } from './HouseFilterForm'

type SavedSearch = {
  id: string
  filters: HouseFilterValues
}

const STORAGE_KEY = 'shawemal.savedHouseSearches'
const CHANGE_EVENT = 'shawemal:saved-house-searches'
const MAX_SAVED_SEARCHES = 8

function normalizeFilters(filters: HouseFilterValues): HouseFilterValues {
  const normalizeBudget = (value: string) => {
    if (!value.trim()) return ''
    const amount = Number(value)
    return Number.isFinite(amount) && amount >= 0 ? String(amount) : ''
  }
  return {
    city: filters.city.trim(),
    type: filters.type.trim(),
    minBudget: normalizeBudget(filters.minBudget),
    maxBudget: normalizeBudget(filters.maxBudget),
  }
}

function filtersId(filters: HouseFilterValues) {
  return JSON.stringify(normalizeFilters(filters))
}

function isSavedSearch(value: unknown): value is SavedSearch {
  if (!value || typeof value !== 'object') return false
  const search = value as Partial<SavedSearch>
  const filters = search.filters as Partial<HouseFilterValues> | undefined
  return (
    typeof search.id === 'string' &&
    Boolean(filters) &&
    typeof filters?.city === 'string' &&
    typeof filters.type === 'string' &&
    typeof filters.minBudget === 'string' &&
    typeof filters.maxBudget === 'string'
  )
}

function readSavedSearches(): SavedSearch[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed.filter(isSavedSearch).slice(0, MAX_SAVED_SEARCHES) : []
  } catch {
    return []
  }
}

function writeSavedSearches(searches: SavedSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
    window.dispatchEvent(new Event(CHANGE_EVENT))
    return true
  } catch {
    return false
  }
}

function formatSearchLabel(filters: HouseFilterValues, allHomesLabel: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const parts = [filters.city, filters.type].filter(Boolean)
  const min = Number(filters.minBudget)
  const max = Number(filters.maxBudget)
  if (filters.minBudget && filters.maxBudget) parts.push(`${formatMmk(min)} – ${formatMmk(max)}`)
  else if (filters.minBudget) parts.push(t('houses.savedSearches.atLeast', { amount: formatMmk(min) }))
  else if (filters.maxBudget) parts.push(t('houses.savedSearches.upTo', { amount: formatMmk(max) }))
  return parts.length > 0 ? parts.join(' · ') : allHomesLabel
}

export function SavedHouseSearches({ filters, onSelect }: { filters: HouseFilterValues; onSelect: (filters: HouseFilterValues) => void }) {
  const { t } = useTranslation()
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = () => setSavedSearches(readSavedSearches())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [])

  const saveCurrentSearch = () => {
    const nextFilters = normalizeFilters(filters)
    const id = filtersId(nextFilters)
    if (savedSearches.some((search) => search.id === id)) {
      setMessage(t('houses.savedSearches.duplicate'))
      return
    }
    if (savedSearches.length >= MAX_SAVED_SEARCHES) {
      setMessage(t('houses.savedSearches.limitReached'))
      return
    }
    if (writeSavedSearches([{ id, filters: nextFilters }, ...savedSearches])) {
      setMessage(t('houses.savedSearches.saved'))
      return
    }
    setMessage(t('houses.savedSearches.saveFailed'))
  }

  const removeSearch = (id: string) => {
    const next = savedSearches.filter((search) => search.id !== id)
    if (writeSavedSearches(next)) {
      setSavedSearches(next)
      setMessage('')
    }
  }

  return (
    <section aria-labelledby="saved-house-searches-title" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h2 id="saved-house-searches-title" className="font-semibold">{t('houses.savedSearches.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('houses.savedSearches.subtitle')}</p>
        </div>
        <Button type="button" variant="outline" onClick={saveCurrentSearch} disabled={savedSearches.length >= MAX_SAVED_SEARCHES}>
          {t('houses.savedSearches.saveCurrent')}
        </Button>
      </div>

      {savedSearches.length > 0 ? (
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {savedSearches.map((search) => {
            const label = formatSearchLabel(search.filters, t('houses.savedSearches.allHomes'), t)
            return (
              <li key={search.id} className="flex min-w-0 items-center gap-1 rounded-lg border bg-muted/40 p-1">
                <Button type="button" variant="ghost" className="min-w-0 justify-start text-left" onClick={() => onSelect(search.filters)}>
                  <span className="truncate">{label}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t('houses.savedSearches.remove', { name: label })}
                  onClick={() => removeSearch(search.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {savedSearches.length >= MAX_SAVED_SEARCHES ? (
        <p className="text-sm text-muted-foreground">{t('houses.savedSearches.limitReached')}</p>
      ) : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  )
}
