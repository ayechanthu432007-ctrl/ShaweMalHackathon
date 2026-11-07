export const YANGON_CENTER = { lat: 16.8409, lng: 96.1735 }

export function buildLocationQuery(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ')
}

export function parseCoordinatePair(
  latitude?: number | string | null,
  longitude?: number | string | null,
): { lat: number; lng: number } | null {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return null
  }
  if (String(latitude).trim() === '' || String(longitude).trim() === '') {
    return null
  }

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null
  }

  return { lat, lng }
}

export function osmSearchUrl(query: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`
}

export function osmMarkerUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}

type NominatimHit = {
  lat: string
  lon: string
}

type NominatimReverseHit = {
  display_name?: string
  address?: {
    house_number?: string
    road?: string
    pedestrian?: string
    footway?: string
    neighbourhood?: string
    suburb?: string
    city_district?: string
    quarter?: string
    municipality?: string
    town?: string
    village?: string
    city?: string
  }
}

export async function geocodeNominatim(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim()
  if (!trimmed) {
    return null
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    q: trimmed,
    countrycodes: 'mm',
    viewbox: '95.9,17.2,96.5,16.65',
    bounded: '0',
  })
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as NominatimHit[]
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  const lat = Number(data[0]?.lat)
  const lng = Number(data[0]?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return { lat, lng }
}

export async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ street: string; township: string } | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
  })
  const response = await fetchImpl(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return null

  const result = (await response.json()) as NominatimReverseHit
  const address = result.address ?? {}
  const road = address.road ?? address.pedestrian ?? address.footway ?? address.neighbourhood ?? ''
  const street = [address.house_number, road].filter(Boolean).join(' ')
  const township =
    address.suburb ??
    address.city_district ??
    address.quarter ??
    address.municipality ??
    address.town ??
    address.village ??
    address.city ??
    ''

  return street || township ? { street, township } : null
}
