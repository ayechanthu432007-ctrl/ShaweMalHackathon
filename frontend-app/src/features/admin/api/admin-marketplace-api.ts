import { toListingQuery } from '@/features/marketplace/api/marketplace-api'
import type {
  AccountStatus,
  ListingCard,
  ListingDetail,
  ListingStatus,
  ModerationStatus,
  Paginated,
  ReportReason,
  SellerBadge,
  SellerContactSettings,
  SellerRating,
} from '@/features/marketplace/types'
import { apiRequest } from '@/lib/api/client'

export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'
export type ModerationAction = 'approve' | 'reject' | 'remove' | 'restore'

export type MarketplaceOverview = {
  totalListings: number
  activeListings: number
  soldItems: number
  reportedListings: number
  suspendedSellers: number
  pendingReviews: number
  openReports: number
}

export type AdminListingRow = ListingCard & {
  moderationNote: string | null
  sellerAccountStatus: AccountStatus
  openReportCount: number
}

export type AdminReport = {
  id: string
  reason: ReportReason
  description: string | null
  status: ReportStatus
  adminNote: string | null
  reporter: { id: string; name: string; email: string }
  reportedUser: { id: string; name: string; email: string; accountStatus: AccountStatus } | null
  listing: { id: string; title: string; moderationStatus: ModerationStatus; status: ListingStatus } | null
  admin: { id: string; name: string } | null
  createdAt: string
  resolvedAt: string | null
}

export type AdminListingDetail = Omit<ListingDetail, 'seller' | 'isOwner' | 'isSaved' | 'canReview'> & {
  seller: ListingDetail['seller']
  moderationNote: string | null
  policyAcceptedAt: string
  sellerAccount: { email: string; phone: string; accountStatus: AccountStatus }
  reports: AdminReport[]
}

export type AdminMarketplaceUserRow = {
  id: string
  name: string
  email: string
  phone: string
  accountStatus: AccountStatus
  badges: SellerBadge[]
  listingCount: number
  openReportCount: number
  createdAt: string
}

export type TrustedSellerEvaluation = {
  criteria: { minSoldListings: number; minReviews: number; minAverageRating: number }
  soldListings: number
  rating: SellerRating
  upheldReports: number
  checks: { identityVerified: boolean; completedTransactions: boolean; goodReviews: boolean; noSeriousReports: boolean }
  eligible: boolean
}

export type AdminMarketplaceUser = {
  id: string
  name: string
  email: string
  phone: string
  profilePicturePath: string | null
  accountStatus: AccountStatus
  phoneVerifiedAt: string | null
  identityVerifiedAt: string | null
  trustedSellerAt: string | null
  createdAt: string
  sellerContact: SellerContactSettings | null
  badges: SellerBadge[]
  trustedSellerEvaluation: TrustedSellerEvaluation
  listingHistory: Array<ListingCard & { moderationNote: string | null }>
  reportsReceived: AdminReport[]
}

export type AdminListingFilters = {
  q?: string
  status?: ListingStatus
  moderationStatus?: ModerationStatus
  reported?: 'true'
  page?: number
}

export type AdminUserFilters = {
  q?: string
  accountStatus?: AccountStatus
  verification?: 'phone_unverified' | 'phone_verified' | 'identity_verified' | 'trusted'
  reported?: 'true'
  page?: number
}

export const adminMarketplaceApi = {
  overview() {
    return apiRequest<MarketplaceOverview>('/admin/marketplace/overview')
  },
  listListings(filters: AdminListingFilters) {
    return apiRequest<Paginated<AdminListingRow>>(`/admin/marketplace/listings${toListingQuery({ ...filters, pageSize: 20 })}`)
  },
  getListing(id: string) {
    return apiRequest<{ listing: AdminListingDetail }>(`/admin/marketplace/listings/${id}`)
  },
  moderateListing(id: string, input: { action: ModerationAction; note?: string }) {
    return apiRequest<{ listing: { id: string; moderationStatus: ModerationStatus } }>(`/admin/marketplace/listings/${id}/moderation`, {
      method: 'PATCH',
      body: input,
    })
  },
  updateListingCategory(id: string, input: { categoryId: string; subcategoryId: string | null }) {
    return apiRequest<{ listing: { id: string } }>(`/admin/marketplace/listings/${id}/category`, { method: 'PATCH', body: input })
  },
  listReports(filters: { status?: ReportStatus; page?: number }) {
    return apiRequest<Paginated<AdminReport>>(`/admin/marketplace/reports${toListingQuery({ ...filters, pageSize: 20 })}`)
  },
  resolveReport(id: string, input: { status: 'RESOLVED' | 'DISMISSED'; adminNote?: string; removeListing?: boolean }) {
    return apiRequest<{ report: AdminReport }>(`/admin/marketplace/reports/${id}`, { method: 'PATCH', body: input })
  },
  listUsers(filters: AdminUserFilters) {
    return apiRequest<Paginated<AdminMarketplaceUserRow>>(`/admin/marketplace/users${toListingQuery({ ...filters, pageSize: 20 })}`)
  },
  getUser(id: string) {
    return apiRequest<{ user: AdminMarketplaceUser }>(`/admin/marketplace/users/${id}`)
  },
  updateAccountStatus(id: string, input: { accountStatus: AccountStatus; reason?: string }) {
    return apiRequest<{ user: AdminMarketplaceUser }>(`/admin/marketplace/users/${id}/status`, { method: 'PATCH', body: input })
  },
  updateVerification(id: string, input: { phoneVerified?: boolean; identityVerified?: boolean; trustedSeller?: boolean }) {
    return apiRequest<{ user: AdminMarketplaceUser }>(`/admin/marketplace/users/${id}/verification`, { method: 'PATCH', body: input })
  },
}
