import { AccountStatus, ListingModerationStatus, ListingReportStatus } from '@prisma/client';
import { Request, Response } from 'express';

import {
  adminGetListing,
  adminGetMarketplaceUser,
  adminListListings,
  adminListMarketplaceUsers,
  adminListReports,
  adminModerateListing,
  adminResolveReport,
  adminUpdateAccountStatus,
  adminUpdateListingCategory,
  adminUpdateSellerVerification,
  getMarketplaceOverview,
  type ModerationAction
} from '../services/admin-marketplace.service';
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

const pagination = (req: Request) => {
  const page = Number(req.query.page);
  const pageSize = Number(req.query.pageSize);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20
  };
};

const optionalBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const paramId = (req: Request): string => String(req.params.id ?? '');

export const adminMarketplaceOverviewController = async (_req: Request, res: Response): Promise<void> => {
  const overview = await getMarketplaceOverview();
  sendSuccess(res, 200, 'Marketplace overview fetched successfully', overview);
};

export const adminMarketplaceListingsController = async (req: Request, res: Response): Promise<void> => {
  const result = await adminListListings({
    q: queryString(req.query.q),
    status: queryString(req.query.status) as 'ACTIVE' | 'SOLD' | undefined,
    moderationStatus: queryString(req.query.moderationStatus) as ListingModerationStatus | undefined,
    reported: req.query.reported === 'true',
    sellerId: queryString(req.query.sellerId),
    ...pagination(req)
  });
  sendSuccess(res, 200, 'Listings fetched successfully', result);
};

export const adminMarketplaceListingController = async (req: Request, res: Response): Promise<void> => {
  const listing = await adminGetListing(paramId(req));
  sendSuccess(res, 200, 'Listing fetched successfully', { listing });
};

export const adminModerateListingController = async (req: Request, res: Response): Promise<void> => {
  const listing = await adminModerateListing({
    actorUserId: requireActor(req),
    listingId: paramId(req),
    action: req.body.action as ModerationAction,
    note: typeof req.body.note === 'string' ? req.body.note : undefined
  });
  sendSuccess(res, 200, 'Listing moderation updated', { listing });
};

export const adminListingCategoryController = async (req: Request, res: Response): Promise<void> => {
  const listing = await adminUpdateListingCategory({
    actorUserId: requireActor(req),
    listingId: paramId(req),
    categoryId: String(req.body.categoryId),
    subcategoryId: typeof req.body.subcategoryId === 'string' && req.body.subcategoryId ? req.body.subcategoryId : null
  });
  sendSuccess(res, 200, 'Listing category updated', { listing });
};

export const adminMarketplaceReportsController = async (req: Request, res: Response): Promise<void> => {
  const result = await adminListReports({
    status: queryString(req.query.status) as ListingReportStatus | undefined,
    ...pagination(req)
  });
  sendSuccess(res, 200, 'Reports fetched successfully', result);
};

export const adminResolveReportController = async (req: Request, res: Response): Promise<void> => {
  const report = await adminResolveReport({
    actorUserId: requireActor(req),
    reportId: paramId(req),
    status: req.body.status as 'RESOLVED' | 'DISMISSED',
    adminNote: typeof req.body.adminNote === 'string' ? req.body.adminNote : undefined,
    removeListing: req.body.removeListing === true
  });
  sendSuccess(res, 200, 'Report updated', { report });
};

export const adminMarketplaceUsersController = async (req: Request, res: Response): Promise<void> => {
  const result = await adminListMarketplaceUsers({
    q: queryString(req.query.q),
    accountStatus: queryString(req.query.accountStatus) as AccountStatus | undefined,
    verification: queryString(req.query.verification) as
      | 'phone_unverified'
      | 'phone_verified'
      | 'identity_verified'
      | 'trusted'
      | undefined,
    reported: req.query.reported === 'true',
    ...pagination(req)
  });
  sendSuccess(res, 200, 'Users fetched successfully', result);
};

export const adminMarketplaceUserController = async (req: Request, res: Response): Promise<void> => {
  const user = await adminGetMarketplaceUser(paramId(req));
  sendSuccess(res, 200, 'User fetched successfully', { user });
};

export const adminAccountStatusController = async (req: Request, res: Response): Promise<void> => {
  const user = await adminUpdateAccountStatus({
    actorUserId: requireActor(req),
    userId: paramId(req),
    accountStatus: req.body.accountStatus as AccountStatus,
    reason: typeof req.body.reason === 'string' ? req.body.reason : undefined
  });
  sendSuccess(res, 200, 'Account status updated', { user });
};

export const adminSellerVerificationController = async (req: Request, res: Response): Promise<void> => {
  const user = await adminUpdateSellerVerification({
    actorUserId: requireActor(req),
    userId: paramId(req),
    phoneVerified: optionalBoolean(req.body.phoneVerified),
    identityVerified: optionalBoolean(req.body.identityVerified),
    trustedSeller: optionalBoolean(req.body.trustedSeller)
  });
  sendSuccess(res, 200, 'Seller verification updated', { user });
};
