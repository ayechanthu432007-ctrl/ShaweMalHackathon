import { Router } from 'express';

import {
  adminAccountStatusController,
  adminListingCategoryController,
  adminMarketplaceListingController,
  adminMarketplaceListingsController,
  adminMarketplaceOverviewController,
  adminMarketplaceReportsController,
  adminMarketplaceUserController,
  adminMarketplaceUsersController,
  adminModerateListingController,
  adminResolveReportController,
  adminSellerVerificationController
} from '../../controllers/admin-marketplace.controller';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  adminAccountStatusValidator,
  adminListingCategoryValidator,
  adminListingIdValidator,
  adminListingsValidator,
  adminMarketplaceUsersValidator,
  adminModerateListingValidator,
  adminReportsValidator,
  adminResolveReportValidator,
  adminSellerVerificationValidator,
  adminUserIdValidator
} from '../../validators/admin-marketplace.validator';

const adminMarketplaceRouter = Router();

adminMarketplaceRouter.use(requireAuth, requireAdmin);

adminMarketplaceRouter.get('/overview', asyncHandler(adminMarketplaceOverviewController));
adminMarketplaceRouter.get('/listings', adminListingsValidator, validateMiddleware, asyncHandler(adminMarketplaceListingsController));
adminMarketplaceRouter.get('/listings/:id', adminListingIdValidator, validateMiddleware, asyncHandler(adminMarketplaceListingController));
adminMarketplaceRouter.patch(
  '/listings/:id/moderation',
  adminModerateListingValidator,
  validateMiddleware,
  asyncHandler(adminModerateListingController)
);
adminMarketplaceRouter.patch(
  '/listings/:id/category',
  adminListingCategoryValidator,
  validateMiddleware,
  asyncHandler(adminListingCategoryController)
);
adminMarketplaceRouter.get('/reports', adminReportsValidator, validateMiddleware, asyncHandler(adminMarketplaceReportsController));
adminMarketplaceRouter.patch('/reports/:id', adminResolveReportValidator, validateMiddleware, asyncHandler(adminResolveReportController));
adminMarketplaceRouter.get('/users', adminMarketplaceUsersValidator, validateMiddleware, asyncHandler(adminMarketplaceUsersController));
adminMarketplaceRouter.get('/users/:id', adminUserIdValidator, validateMiddleware, asyncHandler(adminMarketplaceUserController));
adminMarketplaceRouter.patch('/users/:id/status', adminAccountStatusValidator, validateMiddleware, asyncHandler(adminAccountStatusController));
adminMarketplaceRouter.patch(
  '/users/:id/verification',
  adminSellerVerificationValidator,
  validateMiddleware,
  asyncHandler(adminSellerVerificationController)
);

export { adminMarketplaceRouter };
