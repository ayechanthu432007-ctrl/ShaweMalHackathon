import { apiRequest } from '@/lib/api/client'

import type {
  ContactMethod,
  EditableListing,
  InterestedBuyer,
  ListingCard,
  ListingDetail,
  ListingFormValues,
  ListingSearchParams,
  ListingStatus,
  MarketplaceCategory,
  MarketplaceHome,
  MovingOutSaleInput,
  MovingOutSaleSummary,
  MyMarketplaceDashboard,
  Paginated,
  ReportReason,
  SavedListing,
  SellerContactSettings,
  SellerProfile,
  SellerStatus,
} from '../types'

export function toListingQuery(params: ListingSearchParams | Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const marketplaceApi = {
  home() {
    return apiRequest<MarketplaceHome>('/marketplace/home')
  },
  categories() {
    return apiRequest<{ items: MarketplaceCategory[] }>('/marketplace/categories', { auth: false })
  },
  search(params: ListingSearchParams) {
    return apiRequest<Paginated<ListingCard>>(`/marketplace/listings${toListingQuery(params)}`, { auth: false })
  },
  getListing(id: string) {
    return apiRequest<{ item: ListingDetail }>(`/marketplace/listings/${id}`)
  },
  revealContact(id: string, method: ContactMethod) {
    return apiRequest<{ contact: { method: ContactMethod; value: string; link: string } }>(
      `/marketplace/listings/${id}/contact?method=${method}`,
    )
  },
  reviewSeller(listingId: string, input: { rating: number; comment?: string }) {
    return apiRequest<{ review: { id: string } }>(`/marketplace/listings/${listingId}/review`, {
      method: 'POST',
      body: input,
    })
  },
  getSeller(sellerId: string) {
    return apiRequest<{ seller: SellerProfile }>(`/marketplace/sellers/${sellerId}`, { auth: false })
  },
  report(input: { listingId?: string; reportedUserId?: string; reason: ReportReason; description?: string }) {
    return apiRequest<{ report: { id: string } }>('/marketplace/reports', { method: 'POST', body: input })
  },
  listMovingOutSales() {
    return apiRequest<{ items: MovingOutSaleSummary[] }>('/marketplace/moving-out-sales', { auth: false })
  },
  getMovingOutSale(saleId: string) {
    return apiRequest<{ sale: MovingOutSaleSummary }>(`/marketplace/moving-out-sales/${saleId}`, { auth: false })
  },

  sellerStatus() {
    return apiRequest<SellerStatus>('/marketplace/me/seller-status')
  },
  requestPhoneVerification() {
    return apiRequest<SellerStatus>('/marketplace/me/phone-verification-request', { method: 'POST' })
  },
  updateContact(input: SellerContactSettings) {
    return apiRequest<SellerStatus>('/marketplace/me/contact', { method: 'PUT', body: input })
  },
  dashboard(status?: ListingStatus) {
    return apiRequest<MyMarketplaceDashboard>(`/marketplace/me/dashboard${status ? `?status=${status}` : ''}`)
  },
  createListing(input: ListingFormValues) {
    return apiRequest<{ listing: { id: string; moderationStatus: string } }>('/marketplace/me/listings', {
      method: 'POST',
      body: input,
    })
  },
  getMyListing(id: string) {
    return apiRequest<{ listing: EditableListing }>(`/marketplace/me/listings/${id}`)
  },
  updateListing(id: string, input: ListingFormValues) {
    return apiRequest<{ listing: { id: string; moderationStatus: string } }>(`/marketplace/me/listings/${id}`, {
      method: 'PUT',
      body: input,
    })
  },
  deleteListing(id: string) {
    return apiRequest<{ ok: boolean }>(`/marketplace/me/listings/${id}`, { method: 'DELETE' })
  },
  updateListingStatus(id: string, input: { status: ListingStatus; buyerId?: string | null }) {
    return apiRequest<{ listing: { id: string; status: ListingStatus } }>(`/marketplace/me/listings/${id}/status`, {
      method: 'PATCH',
      body: input,
    })
  },
  interestedBuyers(id: string) {
    return apiRequest<{ items: InterestedBuyer[] }>(`/marketplace/me/listings/${id}/interested-buyers`)
  },
  createMovingOutSale(input: MovingOutSaleInput) {
    return apiRequest<{ sale: { id: string } }>('/marketplace/me/moving-out-sales', { method: 'POST', body: input })
  },
  updateMovingOutSale(saleId: string, input: MovingOutSaleInput) {
    return apiRequest<{ sale: { id: string } }>(`/marketplace/me/moving-out-sales/${saleId}`, {
      method: 'PUT',
      body: input,
    })
  },
  deleteMovingOutSale(saleId: string) {
    return apiRequest<{ ok: boolean }>(`/marketplace/me/moving-out-sales/${saleId}`, { method: 'DELETE' })
  },

  listSaved() {
    return apiRequest<{ items: SavedListing[] }>('/wishlist/listings')
  },
  save(listingId: string) {
    return apiRequest<{ item: { id: string } }>(`/wishlist/listings/${listingId}`, { method: 'POST' })
  },
  unsave(listingId: string) {
    return apiRequest<{ ok: boolean }>(`/wishlist/listings/${listingId}`, { method: 'DELETE' })
  },
}
