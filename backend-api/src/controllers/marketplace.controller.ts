import { ListingCondition, ListingPickupMethod, ListingReportReason, RelocationStatus } from '@prisma/client';
import { Request, Response } from 'express';

import {
  clearMyRelocation,
  createMyListing,
  deleteMyListing,
  deleteMyMovingOutSale,
  getMyListingForEdit,
  getMyMarketplaceDashboard,
  getMyRelocation,
  getMySellerStatus,
  listInterestedBuyers,
  requestPhoneVerification,
  saveMyMovingOutSale,
  saveMyRelocation,
  updateMyListing,
  updateMyListingStatus,
  updateMySellerContact,
  type ListingInput,
  type MovingOutSaleInput
} from '../services/marketplace-seller.service';
import {
  createListingReport,
  createSellerReview,
  getListingDetail,
  getMarketplaceHome,
  getMovingOutSale,
  getRecommendedListings,
  getSellerProfile,
  listMarketplaceCategories,
  listMovingOutSales,
  revealListingContact,
  searchListings,
  type ListingSort
} from '../services/marketplace.service';
import type { ContactMethod } from '../services/marketplace-shared';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

const queryString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const queryNumber = (value: unknown): number | undefined => {
  const raw = queryString(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const queryPositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = queryNumber(value);
  return parsed && parsed > 0 ? Math.min(Math.floor(parsed), max) : fallback;
};

const paramId = (req: Request, name: string): string => String(req.params[name] ?? '');

const optionalNullable = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  return typeof value === 'string' ? (value.trim() ? value.trim() : null) : undefined;
};

const toListingInput = (body: Record<string, unknown>): ListingInput => ({
  title: String(body.title ?? ''),
  description: String(body.description ?? ''),
  categoryId: String(body.categoryId ?? ''),
  subcategoryId: optionalNullable(body.subcategoryId) ?? null,
  price: Number(body.price),
  condition: body.condition as ListingCondition,
  cityId: String(body.cityId ?? ''),
  locationDetail: optionalNullable(body.locationDetail) ?? null,
  pickupMethod: body.pickupMethod as ListingPickupMethod,
  images: Array.isArray(body.images) ? body.images.map(String) : [],
  coverIndex: body.coverIndex === undefined ? 0 : Number(body.coverIndex),
  showPhone: Boolean(body.showPhone),
  showTelegram: Boolean(body.showTelegram),
  showViber: Boolean(body.showViber),
  movingOutSaleId: optionalNullable(body.movingOutSaleId) ?? null,
  policyAccepted: body.policyAccepted === true
});

const toMovingOutSaleInput = (body: Record<string, unknown>): MovingOutSaleInput => ({
  title: String(body.title ?? ''),
  description: optionalNullable(body.description) ?? null,
  originCityId: String(body.originCityId ?? ''),
  destinationCityId: optionalNullable(body.destinationCityId) ?? null,
  moveOutDate: optionalNullable(body.moveOutDate) ?? null,
  isActive: body.isActive === undefined ? true : Boolean(body.isActive)
});

export const marketplaceHomeController = async (req: Request, res: Response): Promise<void> => {
  const home = await getMarketplaceHome(req.auth?.userId);
  sendSuccess(res, 200, 'Marketplace home fetched successfully', home);
};

export const marketplaceCategoriesController = async (_req: Request, res: Response): Promise<void> => {
  const items = await listMarketplaceCategories();
  sendSuccess(res, 200, 'Marketplace categories fetched successfully', { items });
};

export const searchListingsController = async (req: Request, res: Response): Promise<void> => {
  const result = await searchListings({
    q: queryString(req.query.q),
    categoryId: queryString(req.query.categoryId),
    subcategoryId: queryString(req.query.subcategoryId),
    condition: queryString(req.query.condition) as ListingCondition | undefined,
    stateId: queryString(req.query.stateId),
    cityId: queryString(req.query.cityId),
    sellerId: queryString(req.query.sellerId),
    movingOutSaleId: queryString(req.query.movingOutSaleId),
    status: queryString(req.query.status) as 'ACTIVE' | 'SOLD' | undefined,
    minPrice: queryNumber(req.query.minPrice),
    maxPrice: queryNumber(req.query.maxPrice),
    sort: (queryString(req.query.sort) as ListingSort | undefined) ?? 'newest',
    page: queryPositiveInt(req.query.page, 1, 10_000),
    pageSize: queryPositiveInt(req.query.pageSize, 24, 48)
  });

  sendSuccess(res, 200, 'Listings fetched successfully', result);
};

export const recommendationsController = async (req: Request, res: Response): Promise<void> => {
  const result = await getRecommendedListings({
    userId: req.auth?.userId,
    destinationCityId: queryString(req.query.destinationCityId),
    limit: queryPositiveInt(req.query.limit, 12, 24)
  });

  sendSuccess(res, 200, 'Recommendations fetched successfully', result);
};

export const listingDetailController = async (req: Request, res: Response): Promise<void> => {
  const item = await getListingDetail(paramId(req, 'id'), req.auth ? { userId: req.auth.userId, roles: req.auth.roles } : undefined);
  sendSuccess(res, 200, 'Listing fetched successfully', { item });
};

export const revealContactController = async (req: Request, res: Response): Promise<void> => {
  const contact = await revealListingContact(paramId(req, 'id'), requireActor(req), String(req.query.method) as ContactMethod);
  sendSuccess(res, 200, 'Seller contact fetched successfully', { contact });
};

export const sellerProfileController = async (req: Request, res: Response): Promise<void> => {
  const seller = await getSellerProfile(paramId(req, 'sellerId'));
  sendSuccess(res, 200, 'Seller profile fetched successfully', { seller });
};

export const createSellerReviewController = async (req: Request, res: Response): Promise<void> => {
  const review = await createSellerReview({
    listingId: paramId(req, 'id'),
    reviewerUserId: requireActor(req),
    rating: Number(req.body.rating),
    comment: typeof req.body.comment === 'string' ? req.body.comment : undefined
  });
  sendSuccess(res, 201, 'Review submitted successfully', { review });
};

export const createReportController = async (req: Request, res: Response): Promise<void> => {
  const report = await createListingReport({
    reporterId: requireActor(req),
    listingId: queryString(req.body.listingId),
    reportedUserId: queryString(req.body.reportedUserId),
    reason: req.body.reason as ListingReportReason,
    description: typeof req.body.description === 'string' ? req.body.description : undefined
  });
  sendSuccess(res, 201, 'Report submitted. Our team will review it.', { report });
};

export const listMovingOutSalesController = async (_req: Request, res: Response): Promise<void> => {
  const items = await listMovingOutSales(24);
  sendSuccess(res, 200, 'Moving-out sales fetched successfully', { items });
};

export const movingOutSaleDetailController = async (req: Request, res: Response): Promise<void> => {
  const sale = await getMovingOutSale(paramId(req, 'saleId'));
  sendSuccess(res, 200, 'Moving-out sale fetched successfully', { sale });
};

export const mySellerStatusController = async (req: Request, res: Response): Promise<void> => {
  const status = await getMySellerStatus(requireActor(req));
  sendSuccess(res, 200, 'Seller status fetched successfully', status);
};

export const requestPhoneVerificationController = async (req: Request, res: Response): Promise<void> => {
  const status = await requestPhoneVerification(requireActor(req));
  sendSuccess(res, 200, 'Verification request sent to the Shawe Mal team', status);
};

export const updateSellerContactController = async (req: Request, res: Response): Promise<void> => {
  const status = await updateMySellerContact(requireActor(req), {
    phone: optionalNullable(req.body.phone),
    telegramUsername: optionalNullable(req.body.telegramUsername),
    viberNumber: optionalNullable(req.body.viberNumber),
    showPhone: Boolean(req.body.showPhone),
    showTelegram: Boolean(req.body.showTelegram),
    showViber: Boolean(req.body.showViber)
  });
  sendSuccess(res, 200, 'Contact settings saved', status);
};

export const myDashboardController = async (req: Request, res: Response): Promise<void> => {
  const dashboard = await getMyMarketplaceDashboard(requireActor(req), {
    status: queryString(req.query.status) as 'ACTIVE' | 'SOLD' | undefined
  });
  sendSuccess(res, 200, 'Marketplace dashboard fetched successfully', dashboard);
};

export const createMyListingController = async (req: Request, res: Response): Promise<void> => {
  const listing = await createMyListing(requireActor(req), toListingInput(req.body));
  sendSuccess(res, 201, listing.moderationStatus === 'PENDING' ? 'Listing submitted for review' : 'Listing published', { listing });
};

export const getMyListingController = async (req: Request, res: Response): Promise<void> => {
  const listing = await getMyListingForEdit(requireActor(req), paramId(req, 'id'));
  sendSuccess(res, 200, 'Listing fetched successfully', { listing });
};

export const updateMyListingController = async (req: Request, res: Response): Promise<void> => {
  const listing = await updateMyListing(requireActor(req), paramId(req, 'id'), toListingInput(req.body));
  sendSuccess(res, 200, listing.moderationStatus === 'PENDING' ? 'Listing submitted for review' : 'Listing updated', { listing });
};

export const deleteMyListingController = async (req: Request, res: Response): Promise<void> => {
  await deleteMyListing(requireActor(req), paramId(req, 'id'));
  sendSuccess(res, 200, 'Listing deleted', { ok: true });
};

export const updateMyListingStatusController = async (req: Request, res: Response): Promise<void> => {
  const listing = await updateMyListingStatus(requireActor(req), paramId(req, 'id'), {
    status: req.body.status as 'ACTIVE' | 'SOLD',
    buyerId: optionalNullable(req.body.buyerId)
  });
  sendSuccess(res, 200, listing.status === 'SOLD' ? 'Listing marked as sold' : 'Listing is active again', { listing });
};

export const interestedBuyersController = async (req: Request, res: Response): Promise<void> => {
  const items = await listInterestedBuyers(requireActor(req), paramId(req, 'id'));
  sendSuccess(res, 200, 'Interested buyers fetched successfully', { items });
};

export const createMovingOutSaleController = async (req: Request, res: Response): Promise<void> => {
  const sale = await saveMyMovingOutSale(requireActor(req), toMovingOutSaleInput(req.body));
  sendSuccess(res, 201, 'Moving-out sale created', { sale });
};

export const updateMovingOutSaleController = async (req: Request, res: Response): Promise<void> => {
  const sale = await saveMyMovingOutSale(requireActor(req), toMovingOutSaleInput(req.body), paramId(req, 'saleId'));
  sendSuccess(res, 200, 'Moving-out sale updated', { sale });
};

export const deleteMovingOutSaleController = async (req: Request, res: Response): Promise<void> => {
  await deleteMyMovingOutSale(requireActor(req), paramId(req, 'saleId'));
  sendSuccess(res, 200, 'Moving-out sale deleted', { ok: true });
};

export const getRelocationController = async (req: Request, res: Response): Promise<void> => {
  const relocation = await getMyRelocation(requireActor(req));
  sendSuccess(res, 200, 'Moving plan fetched successfully', { relocation });
};

export const saveRelocationController = async (req: Request, res: Response): Promise<void> => {
  const relocation = await saveMyRelocation(requireActor(req), {
    originCityId: optionalNullable(req.body.originCityId) ?? null,
    destinationCityId: String(req.body.destinationCityId),
    moveDate: optionalNullable(req.body.moveDate) ?? null,
    status: (req.body.status as RelocationStatus | undefined) ?? 'PLANNING'
  });
  sendSuccess(res, 200, 'Moving plan saved', { relocation });
};

export const clearRelocationController = async (req: Request, res: Response): Promise<void> => {
  await clearMyRelocation(requireActor(req));
  sendSuccess(res, 200, 'Moving plan cleared', { ok: true });
};
