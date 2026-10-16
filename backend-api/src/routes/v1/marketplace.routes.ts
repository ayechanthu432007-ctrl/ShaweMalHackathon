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
import {
  claimFreeListingBoostController,
  createInquiryController,
  createListingBoostOrderController,
  createSellerSubscriptionOrderController,
  myInquiryController,
  mySellerSubscriptionController,
  recordListingViewController,
  resetDemoSellerSubscriptionController,
  sellerBoostsController,
  sellerDemoPaymentController,
  sellerInquiriesController,
  sellerInsightsController,
  sellerOrderController,
  sellerPlansController,
  updateSellerInquiryController
} from '../../controllers/marketplace-seller-plan.controller';
import { optionalAuth, requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  createInquiryValidator,
  createReportValidator,
  freeListingBoostValidator,
  listingBoostOrderValidator,
  sellerDemoPaymentValidator,
  sellerInquiriesValidator,
  sellerInsightsValidator,
  sellerOrderReferenceValidator,
  sellerPlanOrderValidator,
  updateInquiryValidator,
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
marketplaceRouter.get('/seller-plans', asyncHandler(sellerPlansController));
marketplaceRouter.post('/listings/:id/view', optionalAuth, listingIdParamValidator, validateMiddleware, asyncHandler(recordListingViewController));
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
marketplaceRouter.post('/listings/:id/inquiries', requireAuth, createInquiryValidator, validateMiddleware, asyncHandler(createInquiryController));
marketplaceRouter.get('/listings/:id/inquiries/mine', requireAuth, listingIdParamValidator, validateMiddleware, asyncHandler(myInquiryController));
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

// Seller Dashboard: plan, demo checkout, boosts, insights and inquiries. Entitlements are enforced in the services.
meRouter.get('/subscription', asyncHandler(mySellerSubscriptionController));
meRouter.post('/subscription/orders', sellerPlanOrderValidator, validateMiddleware, asyncHandler(createSellerSubscriptionOrderController));
meRouter.post('/subscription/demo-reset', asyncHandler(resetDemoSellerSubscriptionController));
meRouter.get('/payments/orders/:reference', sellerOrderReferenceValidator, validateMiddleware, asyncHandler(sellerOrderController));
meRouter.post('/payments/orders/:reference/demo', sellerDemoPaymentValidator, validateMiddleware, asyncHandler(sellerDemoPaymentController));
meRouter.get('/boosts', asyncHandler(sellerBoostsController));
meRouter.post('/boosts/orders', listingBoostOrderValidator, validateMiddleware, asyncHandler(createListingBoostOrderController));
meRouter.post('/boosts/free', freeListingBoostValidator, validateMiddleware, asyncHandler(claimFreeListingBoostController));
meRouter.get('/insights', sellerInsightsValidator, validateMiddleware, asyncHandler(sellerInsightsController));
meRouter.get('/inquiries', sellerInquiriesValidator, validateMiddleware, asyncHandler(sellerInquiriesController));
meRouter.patch('/inquiries/:inquiryId', updateInquiryValidator, validateMiddleware, asyncHandler(updateSellerInquiryController));

marketplaceRouter.use('/me', meRouter);

export { marketplaceRouter };
