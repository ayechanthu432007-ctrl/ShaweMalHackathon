import { Router } from 'express';

import {
  createMovingOutSaleController,
  createMyListingController,
  createReportController,
  createSellerReviewController,
  deleteMovingOutSaleController,
  deleteMyListingController,
  getMyListingController,
  interestedBuyersController,
  listingDetailController,
  listMovingOutSalesController,
  marketplaceCategoriesController,
  marketplaceHomeController,
  movingOutSaleDetailController,
  myDashboardController,
  mySellerStatusController,
  recommendationsController,
  requestPhoneVerificationController,
  revealContactController,
  searchListingsController,
  sellerProfileController,
  updateMovingOutSaleController,
  updateMyListingController,
  updateMyListingStatusController,
  updateSellerContactController
} from '../../controllers/marketplace.controller';
import { optionalAuth, requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  createReportValidator,
  createSellerReviewValidator,
  listingBodyValidator,
  listingIdParamValidator,
  movingOutSaleBodyValidator,
  movingOutSaleIdParamValidator,
  myListingsValidator,
  recommendationsValidator,
  revealContactValidator,
  searchListingsValidator,
  sellerContactValidator,
  sellerIdParamValidator,
  updateListingStatusValidator
} from '../../validators/marketplace.validator';

const marketplaceRouter = Router();

// Public browsing (a token, when present, personalizes recommendations and saved state).
marketplaceRouter.get('/home', optionalAuth, asyncHandler(marketplaceHomeController));
marketplaceRouter.get('/categories', asyncHandler(marketplaceCategoriesController));
marketplaceRouter.get('/listings', searchListingsValidator, validateMiddleware, asyncHandler(searchListingsController));
marketplaceRouter.get(
  '/recommendations',
  optionalAuth,
  recommendationsValidator,
  validateMiddleware,
  asyncHandler(recommendationsController)
);
marketplaceRouter.get('/listings/:id', optionalAuth, listingIdParamValidator, validateMiddleware, asyncHandler(listingDetailController));
marketplaceRouter.get('/sellers/:sellerId', sellerIdParamValidator, validateMiddleware, asyncHandler(sellerProfileController));
marketplaceRouter.get('/moving-out-sales', asyncHandler(listMovingOutSalesController));
marketplaceRouter.get(
  '/moving-out-sales/:saleId',
  movingOutSaleIdParamValidator,
  validateMiddleware,
  asyncHandler(movingOutSaleDetailController)
);

// Buyer actions.
marketplaceRouter.get(
  '/listings/:id/contact',
  requireAuth,
  revealContactValidator,
  validateMiddleware,
  asyncHandler(revealContactController)
);
marketplaceRouter.post(
  '/listings/:id/review',
  requireAuth,
  createSellerReviewValidator,
  validateMiddleware,
  asyncHandler(createSellerReviewController)
);
marketplaceRouter.post('/reports', requireAuth, createReportValidator, validateMiddleware, asyncHandler(createReportController));

// Seller ("My Marketplace").
const meRouter = Router();
meRouter.use(requireAuth);
meRouter.get('/seller-status', asyncHandler(mySellerStatusController));
meRouter.post('/phone-verification-request', asyncHandler(requestPhoneVerificationController));
meRouter.put('/contact', sellerContactValidator, validateMiddleware, asyncHandler(updateSellerContactController));
meRouter.get('/dashboard', myListingsValidator, validateMiddleware, asyncHandler(myDashboardController));
meRouter.post('/listings', listingBodyValidator, validateMiddleware, asyncHandler(createMyListingController));
meRouter.get('/listings/:id', listingIdParamValidator, validateMiddleware, asyncHandler(getMyListingController));
meRouter.put('/listings/:id', listingIdParamValidator, listingBodyValidator, validateMiddleware, asyncHandler(updateMyListingController));
meRouter.delete('/listings/:id', listingIdParamValidator, validateMiddleware, asyncHandler(deleteMyListingController));
meRouter.patch('/listings/:id/status', updateListingStatusValidator, validateMiddleware, asyncHandler(updateMyListingStatusController));
meRouter.get('/listings/:id/interested-buyers', listingIdParamValidator, validateMiddleware, asyncHandler(interestedBuyersController));
meRouter.post('/moving-out-sales', movingOutSaleBodyValidator, validateMiddleware, asyncHandler(createMovingOutSaleController));
meRouter.put(
  '/moving-out-sales/:saleId',
  movingOutSaleIdParamValidator,
  movingOutSaleBodyValidator,
  validateMiddleware,
  asyncHandler(updateMovingOutSaleController)
);
meRouter.delete(
  '/moving-out-sales/:saleId',
  movingOutSaleIdParamValidator,
  validateMiddleware,
  asyncHandler(deleteMovingOutSaleController)
);

marketplaceRouter.use('/me', meRouter);

export { marketplaceRouter };
