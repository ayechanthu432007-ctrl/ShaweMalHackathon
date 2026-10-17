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
  houseRules?: string
  bathrooms?: number
  areaSize?: string
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
  match: TenantMatch
}

export type TenantFactor = 'budget' | 'location' | 'amenities' | 'space' | 'timing' | 'rules'
export type FactorStatus = 'match' | 'partial' | 'conflict' | 'unknown'
export type CompatibilityTier = 'HIGH' | 'MEDIUM' | 'LOW'

/** One explanation line; `code` is translated under `match.tenants.reason`. */
export type TenantReason = {
  factor: TenantFactor
  status: Exclude<FactorStatus, 'unknown'>
  code: string
  params?: Record<string, string | number>
}

export type TenantMatch = MatchSummary & {
  tier: CompatibilityTier
  factors: Array<{ key: TenantFactor; status: FactorStatus; weight: number }>
  reasons: TenantReason[]
}

export type TenantMatches = {
  /** Always the unsaved form values: nothing is stored by the analysis. */
  basis: 'DRAFT'
  /** People who chose to be suggested to agents and were checked. */
  evaluated: number
  /** Of those, how many stated too little to score. */
  insufficient: number
  scoredCount: number
  /** Average score of the scored profiles; null when none could be scored. */
  overallScore: number | null
  bestScore: number | null
  strongMatches: number
  tiers: Record<CompatibilityTier, number>
  factorSummary: Array<{ key: TenantFactor; weight: number; match: number; partial: number; conflict: number; unknown: number }>
  method: {
    weights: Record<TenantFactor, number>
    thresholds: { strong: number; medium: number; minJudgedShare: number; highConfidenceShare: number; budgetConflictCap: number }
  }
  total: number
  page: number
  pageSize: number
  items: PotentialTenant[]
}

export type OccupationFactor = 'affordability' | 'facilities' | 'location' | 'space' | 'rules'

export type OccupationCompatibility = {
  id: string
  name: string
  /** Null when the form gives no information to judge yet. */
  score: number | null
  judgedShare: number
  limited: boolean
  weights: Record<OccupationFactor, number>
  reasons: Array<{ factor: OccupationFactor; effect: 'up' | 'down' | 'neutral'; code: string; params?: Record<string, string | number> }>
  missing: OccupationFactor[]
}

export type OccupationCompatibilityResult = {
  basis: 'DRAFT'
  typicalRent: number | null
  method: { weights: Record<OccupationFactor, number>; minJudgedShare: number }
  items: OccupationCompatibility[]
}

export type OccupationDraft = {
  monthlyFees?: number
  bedrooms?: number
  bathrooms?: number
  areaSize?: string
  amenityIds?: string[]
  nearbyPlaces?: string
  description?: string
  houseRules?: string
}

export const recommendationsApi = {
  occupationCompatibility(draft: OccupationDraft) {
    return apiRequest<OccupationCompatibilityResult>('/agent/houses/occupation-compatibility', { method: 'POST', body: draft })
  },
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
