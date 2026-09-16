export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'] as const
export type ListingCondition = (typeof LISTING_CONDITIONS)[number]

export const PICKUP_METHODS = ['MEET_UP', 'SELLER_DELIVERY', 'BUYER_PICKUP', 'DISCUSS'] as const
export type PickupMethod = (typeof PICKUP_METHODS)[number]

export const REPORT_REASONS = [
  'SCAM',
  'WRONG_INFORMATION',
  'FAKE_ITEM',
  'PROHIBITED_ITEM',
  'DUPLICATE_LISTING',
  'OFFENSIVE_CONTENT',
  'INAPPROPRIATE_IMAGE',
  'WRONG_CATEGORY',
  'SUSPICIOUS_PAYMENT',
  'OTHER',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const RELOCATION_STATUSES = ['PLANNING', 'MOVING', 'SETTLED'] as const
export type RelocationStatus = (typeof RELOCATION_STATUSES)[number]

export type ListingStatus = 'ACTIVE' | 'SOLD'
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED'
export type SellerBadge = 'PHONE_VERIFIED' | 'IDENTITY_VERIFIED' | 'TRUSTED_SELLER'
export type ContactMethod = 'phone' | 'telegram' | 'viber'
export type ListingSort = 'newest' | 'price_asc' | 'price_desc'

export type NamedRef = { id: string; name: string }

export type CategoryRef = NamedRef & { nameMy: string | null; slug: string }

export type MarketplaceCategory = CategoryRef & { children: CategoryRef[] }

export type SellerRating = { average: number | null; count: number }

export type SellerSummary = {
  id: string
  name: string
  profilePicturePath: string | null
  joinedAt: string
  badges: SellerBadge[]
  rating: SellerRating
}

export type ListingCard = {
  id: string
  title: string
  price: number
  condition: ListingCondition
  status: ListingStatus
  moderationStatus: ModerationStatus
  category: CategoryRef
  subcategory: CategoryRef | null
  city: NamedRef
  state: NamedRef
  locationDetail: string | null
  thumbnail: string | null
  seller: SellerSummary
  movingOutSaleId: string | null
  publishedAt: string | null
  soldAt: string | null
  createdAt: string
}

export type ListingImage = {
  id: string
  imagePath: string
  optimizedPath: string
  thumbnailPath: string
  displayOrder: number
  isCover: boolean
}

export type ListingDetail = Omit<ListingCard, 'seller'> & {
  description: string
  pickupMethod: PickupMethod
  images: ListingImage[]
  contactMethods: ContactMethod[]
  movingOutSale: { id: string; title: string; isActive: boolean } | null
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null
  seller: SellerSummary & { soldListingCount: number }
  moderationNote?: string | null
  isOwner: boolean
  isSaved: boolean
  canReview: boolean
  updatedAt: string
}

export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type ListingSearchParams = {
  q?: string
  categoryId?: string
  subcategoryId?: string
  condition?: ListingCondition
  cityId?: string
  minPrice?: number
  maxPrice?: number
  sellerId?: string
  movingOutSaleId?: string
  status?: ListingStatus
  sort?: ListingSort
  page?: number
  pageSize?: number
}

export type VerifiedSeller = SellerSummary & { activeListingCount: number }

export type MovingOutSaleSummary = {
  id: string
  title: string
  description: string | null
  originCity: NamedRef
  destinationCity: NamedRef | null
  moveOutDate: string | null
  isActive: boolean
  seller: SellerSummary
  activeListingCount: number
  previewImages: string[]
  createdAt: string
}

export type MarketplaceHome = {
  categories: MarketplaceCategory[]
  recommended: ListingCard[]
  recommendedForDestinationCityId: string | null
  recentlyListed: ListingCard[]
  verifiedSellers: VerifiedSeller[]
  movingOutSales: MovingOutSaleSummary[]
}

export type SellerProfile = SellerSummary & {
  listingCount: number
  activeListingCount: number
  soldListingCount: number
  reviews: Array<{
    id: string
    rating: number
    comment: string | null
    reviewer: { id: string; name: string; profilePicturePath: string | null }
    listing: { id: string; title: string } | null
    createdAt: string
  }>
}

export type SellerContactSettings = {
  phone: string | null
  telegramUsername: string | null
  viberNumber: string | null
  showPhone: boolean
  showTelegram: boolean
  showViber: boolean
}

export type SellerStatus = {
  accountStatus: AccountStatus
  badges: SellerBadge[]
  canSell: boolean
  phoneVerificationRequestedAt: string | null
  contact: SellerContactSettings
}

export type ListingFormValues = {
  title: string
  description: string
  categoryId: string
  subcategoryId: string | null
  price: number
  condition: ListingCondition
  cityId: string
  locationDetail: string | null
  pickupMethod: PickupMethod
  images: string[]
  coverIndex: number
  showPhone: boolean
  showTelegram: boolean
  showViber: boolean
  movingOutSaleId: string | null
  policyAccepted: boolean
}

export type EditableListing = Omit<ListingFormValues, 'policyAccepted'> & {
  id: string
  stateId: string
  status: ListingStatus
  moderationStatus: ModerationStatus
  moderationNote: string | null
}

export type MyListing = ListingCard & {
  moderationNote: string | null
  contactCount: number
  saveCount: number
}

export type MyMovingOutSale = {
  id: string
  title: string
  description: string | null
  originCity: NamedRef
  destinationCity: NamedRef | null
  moveOutDate: string | null
  isActive: boolean
  listingCount: number
  createdAt: string
}

export type MyMarketplaceDashboard = {
  activeCount: number
  soldCount: number
  needsAttentionCount: number
  listings: MyListing[]
  movingOutSales: MyMovingOutSale[]
}

export type MovingOutSaleInput = {
  title: string
  description: string | null
  originCityId: string
  destinationCityId: string | null
  moveOutDate: string | null
  isActive: boolean
}

export type InterestedBuyer = {
  id: string
  name: string
  profilePicturePath: string | null
  contactedAt: string
}

export type Relocation = {
  originCity: NamedRef | null
  destinationCity: NamedRef
  moveDate: string | null
  status: RelocationStatus
  updatedAt: string
}

export type RelocationInput = {
  originCityId: string | null
  destinationCityId: string
  moveDate: string | null
  status: RelocationStatus
}

export type SavedListing = {
  id: string
  listingId: string
  createdAt: string
  listing: ListingCard
}
