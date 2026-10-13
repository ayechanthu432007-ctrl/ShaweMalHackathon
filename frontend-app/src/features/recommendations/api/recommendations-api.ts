import { apiRequest } from '@/lib/api/client'

type NamedRef = { id: string; name: string }

export type MatchConfidence = 'HIGH' | 'LOW' | 'INCOMPLETE'

/** A calculated compatibility score. Factor keys are translated under `match.factors`. */
export type MatchSummary = {
  score: number
  confidence: MatchConfidence
  matched: string[]
  conflicts: string[]
  missing: string[]
}

export type HousingPreferences = {
  budgetMin: number | null
  budgetMax: number | null
  preferredCity: NamedRef | null
  propertyType: NamedRef | null
  bedroomsMin: number | null
  wantsFurnished: boolean | null
  needsInternet: boolean | null
  needsQuiet: boolean | null
  amenityIds: string[]
  moveInDate: string | null
  leaseMonths: number | null
  roomArrangement: string | null
  cleanliness: string | null
  sleepSchedule: string | null
  smoking: string | null
  noiseTolerance: string | null
  socialLevel: string | null
  guests: string | null
  sharesChores: boolean | null
  visibleToAgents: boolean
}

export type HousingPreferencesResponse = {
  occupation: NamedRef | null
  preferences: HousingPreferences | null
}

/** Null clears an answer; a field left out is not changed. */
export type HousingPreferencesInput = {
  occupationId?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
  preferredCityId?: string | null
  propertyTypeId?: string | null
  bedroomsMin?: number | null
  wantsFurnished?: boolean | null
  needsInternet?: boolean | null
  needsQuiet?: boolean | null
  moveInDate?: string | null
  leaseMonths?: number | null
  roomArrangement?: string | null
  cleanliness?: string | null
  sleepSchedule?: string | null
  smoking?: string | null
  noiseTolerance?: string | null
  socialLevel?: string | null
  guests?: string | null
  sharesChores?: boolean | null
  visibleToAgents?: boolean
}

export type RecommendedHouse = {
  house: {
    id: string
    title: string
    monthlyFees: number
    bedrooms: number
    bathrooms: number
    propertyType: NamedRef | null
    city: NamedRef | null
    state: NamedRef | null
    thumbnail: string | null
    amenities: string[]
  }
  match: MatchSummary
}

export type HouseRecommendations = {
  userName: string
  hasPreferences: boolean
  hasOccupation: boolean
  items: RecommendedHouse[]
}

export type RecommendedRoommate = {
  post: {
    id: string
    title: string
    budgetCostSharing: string
    gender: string
    occupation: NamedRef | null
    photos: string[]
    user: { id: string; name: string; phone: string | null; profilePicturePath: string | null }
    house: { id: string; title: string; city: NamedRef | null; state: NamedRef | null }
  }
  match: MatchSummary
}

export type RoommateRecommendations = {
  userName: string
  hasPreferences: boolean
  total: number
  page: number
  pageSize: number
  items: RecommendedRoommate[]
}

export type ListingDraft = {
  monthlyFees: number
  cityId: string
  stateId?: string
  propertyTypeId?: string
  contractTypeId?: string
  bedrooms?: number
  amenityIds?: string[]
  nearbyPlaces?: string
  description?: string
}

export type PotentialTenant = {
  user: { id: string; name: string; profilePicturePath: string | null; occupation: string | null }
  lookingFor: {
    preferredCity: string | null
    budgetMin: number | null
    budgetMax: number | null
    bedroomsMin: number | null
    propertyType: string | null
    moveInDate: string | null
    leaseMonths: number | null
  }
  match: MatchSummary
}

export type TenantMatches = { total: number; page: number; pageSize: number; items: PotentialTenant[] }

export const recommendationsApi = {
  getPreferences() {
    return apiRequest<HousingPreferencesResponse>('/profile/housing-preferences')
  },
  savePreferences(input: HousingPreferencesInput) {
    return apiRequest<HousingPreferencesResponse>('/profile/housing-preferences', { method: 'PUT', body: input })
  },
  houses() {
    return apiRequest<HouseRecommendations>('/recommendations/houses?limit=5')
  },
  tenantMatches(draft: ListingDraft) {
    return apiRequest<TenantMatches>('/agent/houses/tenant-matches', { method: 'POST', body: { ...draft, pageSize: 5 } })
  },
}
