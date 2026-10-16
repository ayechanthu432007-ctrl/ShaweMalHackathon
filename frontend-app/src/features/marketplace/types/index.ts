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

export type ListingStatus = 'ACTIVE' | 'SOLD'
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED'
export type SellerBadge = 'PHONE_VERIFIED' | 'IDENTITY_VERIFIED' | 'TRUSTED_SELLER' | 'PREMIUM_SELLER'
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
  /** Set when the product is shown in a promoted position because of an active boost. */
  boosted?: boolean
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
  /** Premium sellers' products for the homepage Featured row. */
  featured?: ListingCard[]
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

export type BoostStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'CANCELLED' | 'PAUSED'

export type MyListing = ListingCard & {
  moderationNote: string | null
  contactCount: number
  saveCount: number
  inquiryCount: number
  /** Unique daily views recorded since view tracking started. */
  viewCount: number
  boost: { source: 'FREE_ENTITLEMENT' | 'PURCHASED'; startsAt: string; endsAt: string; status: BoostStatus } | null
}

/** Active products a seller may have live at once. limit null = unlimited. */
export type ListingAllowance = { planCode: string; used: number; limit: number | null; remaining: number | null }

export type SellerPlanCode = 'SELLER_FREE' | 'SELLER_PREMIUM' | (string & {})

export type SellerPlan = {
  code: SellerPlanCode
  name: string
  rank: number
  monthlyPriceMmk: number
  activeListingLimit: number | null
  freeBoostDays: number
  premiumBadge: boolean
  homepageFeatured: boolean
  insightsLevel: 'BASIC' | 'DETAILED'
}

export type SellerFreeBoost = { days: number; claimed: boolean; available: boolean; expiresAt: string | null }

export type SellerSubscriptionState = {
  plan: SellerPlan
  status: 'FREE' | 'ACTIVE' | 'EXPIRED'
  subscription: { startsAt: string; endsAt: string } | null
  renewal: { plan: SellerPlan; startsAt: string; endsAt: string } | null
  allowance: ListingAllowance
  freeBoost: SellerFreeBoost
  plans: SellerPlan[]
  demoPayments: boolean
}

export type SellerOrder = {
  reference: string
  kind: 'SELLER_SUBSCRIPTION' | 'LISTING_BOOST'
  plan: { code: string; name: string } | null
  listingId: string | null
  boostDays: number | null
  amountMmk: number
  currency: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
  isDemo: boolean
  expiresAt: string
  paidAt: string | null
  createdAt: string
}

export type SellerBoostRecord = {
  id: string
  listing: { id: string; title: string }
  source: 'FREE_ENTITLEMENT' | 'PURCHASED'
  days: number
  startsAt: string
  endsAt: string
  status: BoostStatus
}

export type SellerBoosts = {
  items: SellerBoostRecord[]
  freeBoost: SellerFreeBoost
  options: Array<{ days: number; priceMmk: number }>
  pricePerDayMmk: number
  demoPayments: boolean
}

export type InquiryStatus = 'NEW' | 'REPLIED' | 'CLOSED'

export type SellerInquiry = {
  id: string
  listing: { id: string; title: string }
  buyer: { id: string; name: string; profilePicturePath: string | null }
  message: string
  status: InquiryStatus
  sellerReply: string | null
  read: boolean
  repliedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SellerInquiries = { counts: Record<InquiryStatus, number>; unread: number; items: SellerInquiry[] }

export type MyInquiry = { id: string; message: string; status: InquiryStatus; sellerReply: string | null; repliedAt: string | null; createdAt: string }

export type SellerInsightProduct = {
  listing: { id: string; title: string; status: ListingStatus }
  views: number
  inquiries: number
  totalViews: number
  inquiryRate: number | null
}

export type SellerInsights = {
  level: 'BASIC' | 'DETAILED'
  days: number
  availableRanges: number[]
  /** First day (Asia/Yangon) with recorded views; earlier days have no data. */
  trackingSince: string | null
  totals: { views: number; inquiries: number; allTimeViews: number }
  products: SellerInsightProduct[]
  /** Null on Free Seller (detailed trends are a Premium feature). Null values = no data for that day. */
  series: Array<{ day: string; views: number | null; inquiries: number | null }> | null
  bestPerforming: SellerInsightProduct[] | null
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
  /** Active-product slots from the seller plan; the server refuses posts beyond it. */
  allowance: ListingAllowance
  plan: { code: SellerPlanCode; name: string; endsAt: string | null }
  summary: { totalProducts: number; totalViews: number; newInquiries: number; activeBoosts: number }
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

export type SavedListing = {
  id: string
  listingId: string
  createdAt: string
  listing: ListingCard
}
