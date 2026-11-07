import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/common/CoverImage'
import { formatMmk } from '@/lib/format'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { HouseCard } from './HouseCard'
import { isHouseAvailable } from '../lib/availability'
import type { HouseListItem, WishlistItem } from '../types'

const MAX_COMPARE_HOUSES = 3

export function SavedHouseComparison({ items }: { items: WishlistItem[] }) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)

  const selectedHouses = useMemo(
    () => items.filter((item) => selectedIds.includes(item.house.id)).map((item) => item.house),
    [items, selectedIds],
  )
  const atLimit = selectedIds.length >= MAX_COMPARE_HOUSES

  const toggleHouse = (houseId: string) => {
    setSelectedIds((current) => {
      if (current.includes(houseId)) return current.filter((id) => id !== houseId)
      if (current.length >= MAX_COMPARE_HOUSES) return current
      return [...current, houseId]
    })
  }

  const details: { label: string; value: (house: HouseListItem) => string }[] = [
    { label: t('profile.houseCompare.monthlyRent'), value: (house) => `${formatMmk(house.monthlyFees)}${t('houses.perMonthShort')}` },
    { label: t('profile.houseCompare.deposit'), value: (house) => (house.depositAmount === undefined ? t('profile.houseCompare.notProvided') : formatMmk(house.depositAmount)) },
    { label: t('profile.houseCompare.bedrooms'), value: (house) => (house.bedrooms === undefined ? t('profile.houseCompare.notProvided') : t('houses.bedCount', { count: house.bedrooms })) },
    { label: t('profile.houseCompare.bathrooms'), value: (house) => (house.bathrooms === undefined ? t('profile.houseCompare.notProvided') : t('houses.bathCount', { count: house.bathrooms })) },
    { label: t('profile.houseCompare.floorArea'), value: (house) => house.areaSize || t('profile.houseCompare.notProvided') },
    { label: t('profile.houseCompare.propertyType'), value: (house) => house.propertyType?.name || t('profile.houseCompare.notProvided') },
    { label: t('profile.houseCompare.location'), value: (house) => [house.city?.name, house.state?.name].filter(Boolean).join(', ') || t('houses.locationUnknown') },
    { label: t('profile.houseCompare.availability'), value: (house) => t(isHouseAvailable(house.availability) ? 'houses.available' : 'houses.notAvailable') },
  ]

  return (
    <div className="space-y-5">
      <section aria-labelledby="house-compare-title" className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 id="house-compare-title" className="text-lg font-semibold">{t('profile.houseCompare.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('profile.houseCompare.description')}</p>
          </div>
          <p className="shrink-0 text-sm font-medium text-muted-foreground">
            {t('profile.houseCompare.selectedCount', { count: selectedIds.length, max: MAX_COMPARE_HOUSES })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="cta" disabled={selectedHouses.length < 2} onClick={() => setShowComparison(true)}>
            {t('profile.houseCompare.compareButton')}
          </Button>
          {selectedIds.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedIds([])
                setShowComparison(false)
              }}
            >
              {t('profile.houseCompare.clearSelection')}
            </Button>
          ) : null}
          {atLimit ? <span className="text-sm text-muted-foreground">{t('profile.houseCompare.limitReached')}</span> : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const selected = selectedIds.includes(item.house.id)
          const disabled = atLimit && !selected
          return (
            <div key={item.id} className="space-y-2">
              <HouseCard house={item.house} />
              <label
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent/50'
                } ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => toggleHouse(item.house.id)}
                  className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={t('profile.houseCompare.selectHouse', { title: item.house.title })}
                />
                <span>{t('profile.houseCompare.selectLabel')}</span>
              </label>
            </div>
          )
        })}
      </div>

      {showComparison && selectedHouses.length >= 2 ? (
        <section aria-labelledby="house-comparison-results" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="house-comparison-results" className="text-xl font-semibold">{t('profile.houseCompare.resultsTitle')}</h2>
            <Button type="button" variant="outline" onClick={() => setShowComparison(false)}>
              {t('profile.houseCompare.hideComparison')}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <caption className="sr-only">{t('profile.houseCompare.resultsTitle')}</caption>
              <thead>
                <tr className="border-b bg-muted/60">
                  <th scope="col" className="w-36 p-3 align-top font-medium text-muted-foreground sm:w-44">{t('profile.houseCompare.feature')}</th>
                  {selectedHouses.map((house) => (
                    <th key={house.id} scope="col" className="w-56 min-w-52 p-3 align-top sm:w-64">
                      <Link to={`/houses/${house.id}`} className="group block space-y-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted">
                          <CoverImage
                            src={resolvePublicUploadUrl(house.thumbnail)}
                            alt={house.title}
                            fallbackLabel={t('houses.noPhoto')}
                            className="transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none"
                          />
                        </div>
                        <span className="line-clamp-2 text-base font-semibold text-foreground group-hover:text-primary">{house.title}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => (
                  <tr key={detail.label} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    <th scope="row" className="p-3 font-medium text-muted-foreground">{detail.label}</th>
                    {selectedHouses.map((house) => (
                      <td key={house.id} className="p-3 font-medium text-foreground">{detail.value(house)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
