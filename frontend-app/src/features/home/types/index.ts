import type { HouseListItem, NamedRef } from '@/features/houses/types'

export type HomeVerifiedAgent = {
  id: string
  name: string
  phone?: string | null
  profilePicturePath?: string | null
  verificationStatus?: string
  /** Admin-verified and on a plan that includes the public Verified Badge. */
  hasVerifiedBadge?: boolean
  agentProfile?: {
    city?: NamedRef | null
    serviceRegion?: NamedRef | null
  } | null
}

export type HomePartnerMovingService = {
  id: string
  name: string
  driverProfile?: {
    companyName?: string | null
    vehicleType?: NamedRef | null
  } | null
}

export type HomeServiceReview = {
  id: string
  rating: number
  comment?: string | null
  targetType?: string
  createdAt?: string
  reviewer?: { id: string; name: string } | null
  targetUser?: { id: string; name: string } | null
}

export type HomeNewsUpdate = {
  id: string
  title: string
  summary: string
  publishedAt: string
}

export type HomePopularHouse = {
  id: string
  title: string
  monthlyFees: number
  propertyType?: NamedRef | null
  city?: NamedRef | null
  thumbnail?: string | null
}

export type HomePageContent = {
  featuredHouses: HouseListItem[]
  popularRecommended: HomePopularHouse[]
  verifiedAgents: HomeVerifiedAgent[]
  partnerMovingServices: HomePartnerMovingService[]
  serviceReviews: HomeServiceReview[]
  newsUpdates: HomeNewsUpdate[]
}
