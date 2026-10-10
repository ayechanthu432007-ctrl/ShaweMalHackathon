export type NamedRef = {
  id: string
  name: string
}

export type HouseListItem = {
  id: string
  title: string
  postChannel?: string
  availability?: string
  monthlyFees: number
  depositAmount?: number
  bedrooms?: number
  bathrooms?: number
  propertyType?: NamedRef | null
  city?: NamedRef | null
  state?: NamedRef | null
  thumbnail?: string | null
  createdAt?: string
  /** Paid or entitled placement; shown with a "Boosted" label. */
  isBoosted?: boolean
}

export type HouseDetails = {
  id: string
  title: string
  description?: string | null
  postChannel?: string
  availability?: string
  monthlyFees: number
  depositAmount: number
  areaSize?: string | null
  bedrooms: number
  bathrooms: number
  houseRules?: string | null
  contact: {
    phone?: string | null
    telegram?: string | null
    viber?: string | null
  }
  location: {
    city?: NamedRef | null
    state?: NamedRef | null
    nearbyPlaces?: string | null
    streetAddress?: string | null
    latitude?: number | null
    longitude?: number | null
  }
  propertyType?: NamedRef | null
  contractType?: (NamedRef & { durationMonths?: number }) | null
  floorLevel?: (NamedRef & { levelNumber?: number | null }) | null
  images: Array<{ id?: string; imagePath: string; sortOrder?: number }>
  amenities: Array<{ id: string; name: string; category?: string | null }>
  agent: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    verificationStatus?: string
  }
  createdAt?: string
  updatedAt?: string
}

export type HouseListResult = {
  items: HouseListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type HouseSearchParams = {
  city?: string
  type?: string
  minBudget?: number
  maxBudget?: number
  page?: number
  pageSize?: number
}

export type HouseBookingResult = {
  booking: {
    id: string
    houseId: string
    userId: string
    status: string
  }
  promptMovingService: boolean
}

export type WishlistItem = {
  id: string
  houseId: string
  createdAt: string
  house: HouseListItem
}
