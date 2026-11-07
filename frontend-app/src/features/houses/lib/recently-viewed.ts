import type { HouseDetails, HouseListItem } from '../types'

const STORAGE_KEY = 'shawemal.recentlyViewedHouses'
const CHANGE_EVENT = 'shawemal:recently-viewed-houses'
const MAX_RECENT_HOUSES = 6

function isHouseListItem(value: unknown): value is HouseListItem {
  if (!value || typeof value !== 'object') return false
  const house = value as Partial<HouseListItem>
  return typeof house.id === 'string' && typeof house.title === 'string' && typeof house.monthlyFees === 'number'
}

export function getRecentlyViewedHouses(): HouseListItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed.filter(isHouseListItem).slice(0, MAX_RECENT_HOUSES) : []
  } catch {
    return []
  }
}

export function saveRecentlyViewedHouse(house: HouseDetails): void {
  const firstImage = [...house.images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]?.imagePath ?? null
  const listItem: HouseListItem = {
    id: house.id,
    title: house.title,
    monthlyFees: house.monthlyFees,
    depositAmount: house.depositAmount,
    bedrooms: house.bedrooms,
    bathrooms: house.bathrooms,
    areaSize: house.areaSize,
    propertyType: house.propertyType,
    city: house.location.city,
    state: house.location.state,
    thumbnail: firstImage,
    availability: house.availability,
    createdAt: house.createdAt,
  }

  try {
    const next = [listItem, ...getRecentlyViewedHouses().filter((item) => item.id !== house.id)].slice(0, MAX_RECENT_HOUSES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Viewing the listing should work even when browser storage is unavailable.
  }
}

export { CHANGE_EVENT as RECENTLY_VIEWED_HOUSES_CHANGE_EVENT }
