import { Request, Response } from 'express';

import {
  createListingInquiry,
  getMyInquiryForListing,
  getSellerInsights,
  listSellerInquiries,
  recordListingView,
  updateSellerInquiry,
  type InquiryStatus
} from '../services/marketplace-insights.service';
import {
  claimFreeListingBoost,
  getListingAllowance,
  getListingBoostPricePerDay,
  getSellerEffectivePlan,
  getSellerFreeBoost,
  LISTING_BOOST_DAY_OPTIONS,
  listSellerBoosts,
  listSellerPlans,
  serializeSellerPlan
} from '../services/marketplace-plan.service';
import {
  createListingBoostOrder,
  createSellerSubscriptionOrder,
  demoPaymentProvider,
  getOwnedOrder,
  resetDemoSellerSubscriptions,
  serializeOrder,
  simulateDemoPayment,
  type PaymentOutcome
} from '../services/payment.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }
  return req.auth.userId;
};

/** Public plan catalogue for the comparison page. */
export const sellerPlansController = async (_req: Request, res: Response): Promise<void> => {
  const plans = await listSellerPlans();
  sendSuccess(res, 200, 'Seller plans fetched successfully', {
    plans: plans.map(serializeSellerPlan),
    demoPayments: demoPaymentProvider.isAvailable()
  });
};

/** The signed-in seller's persisted plan state. Never derived from the client. */
export const mySellerSubscriptionController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const now = new Date();
  const [effective, allowance, freeBoost, plans] = await Promise.all([
    getSellerEffectivePlan(userId, now),
    getListingAllowance(userId, now),
    getSellerFreeBoost(userId, now),
    listSellerPlans()
  ]);

  sendSuccess(res, 200, 'Seller subscription fetched successfully', {
    plan: serializeSellerPlan(effective.plan),
    status: effective.subscription ? 'ACTIVE' : effective.hasExpiredPaidPlan ? 'EXPIRED' : 'FREE',
    subscription: effective.subscription ? { startsAt: effective.subscription.startsAt, endsAt: effective.subscription.endsAt } : null,
    renewal: effective.renewal ? { plan: serializeSellerPlan(effective.renewal.plan), startsAt: effective.renewal.startsAt, endsAt: effective.renewal.endsAt } : null,
    allowance,
    freeBoost,
    plans: plans.map(serializeSellerPlan),
    demoPayments: demoPaymentProvider.isAvailable()
  });
};

export const createSellerSubscriptionOrderController = async (req: Request, res: Response): Promise<void> => {
  // Only the plan is read from the request; the price comes from the plan catalogue.
  const order = await createSellerSubscriptionOrder(requireActor(req), String(req.body.planCode).toUpperCase());
  sendSuccess(res, 201, 'Order created successfully', { order });
};

export const sellerOrderController = async (req: Request, res: Response): Promise<void> => {
  const order = await getOwnedOrder(requireActor(req), String(req.params.reference));
  if (order.kind !== 'SELLER_SUBSCRIPTION' && order.kind !== 'LISTING_BOOST') {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  const listing = order.listingId ? { id: order.listingId } : null;
  sendSuccess(res, 200, 'Order fetched successfully', { order: { ...serializeOrder(order), listing } });
};

export const sellerDemoPaymentController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const reference = String(req.params.reference);
  const order = await getOwnedOrder(userId, reference);
  if (order.kind !== 'SELLER_SUBSCRIPTION' && order.kind !== 'LISTING_BOOST') {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  const result = await simulateDemoPayment(userId, reference, String(req.body.outcome).toUpperCase() as PaymentOutcome);
  sendSuccess(res, 200, 'Demo payment processed', result);
};

export const resetDemoSellerSubscriptionController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Demo subscription reset to Free Seller', await resetDemoSellerSubscriptions(requireActor(req)));
};

export const sellerBoostsController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const [items, freeBoost, pricePerDay] = await Promise.all([listSellerBoosts(userId), getSellerFreeBoost(userId), getListingBoostPricePerDay()]);
  sendSuccess(res, 200, 'Boosts fetched successfully', {
    items,
    freeBoost,
    options: LISTING_BOOST_DAY_OPTIONS.map((days) => ({ days, priceMmk: days * pricePerDay })),
    pricePerDayMmk: pricePerDay,
    demoPayments: demoPaymentProvider.isAvailable()
  });
};

export const createListingBoostOrderController = async (req: Request, res: Response): Promise<void> => {
  const order = await createListingBoostOrder(requireActor(req), String(req.body.listingId), Number(req.body.days));
  sendSuccess(res, 201, 'Order created successfully', { order });
};

export const claimFreeListingBoostController = async (req: Request, res: Response): Promise<void> => {
  const boost = await claimFreeListingBoost(requireActor(req), String(req.body.listingId));
  sendSuccess(res, 201, 'Free boost applied successfully', { boost: { id: boost.id, days: boost.days, startsAt: boost.startsAt, endsAt: boost.endsAt } });
};

export const sellerInsightsController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Insights fetched successfully', { insights: await getSellerInsights(requireActor(req), Number(req.query.days ?? 7)) });
};

export const sellerInquiriesController = async (req: Request, res: Response): Promise<void> => {
  const status = typeof req.query.status === 'string' ? (req.query.status as InquiryStatus) : undefined;
  sendSuccess(res, 200, 'Inquiries fetched successfully', await listSellerInquiries(requireActor(req), { status }));
};

export const updateSellerInquiryController = async (req: Request, res: Response): Promise<void> => {
  const inquiry = await updateSellerInquiry(requireActor(req), String(req.params.inquiryId), {
    status: req.body.status as InquiryStatus | undefined,
    reply: typeof req.body.reply === 'string' ? req.body.reply : undefined,
    read: typeof req.body.read === 'boolean' ? req.body.read : undefined
  });
  sendSuccess(res, 200, 'Inquiry updated successfully', { inquiry });
};

export const createInquiryController = async (req: Request, res: Response): Promise<void> => {
  const inquiry = await createListingInquiry(requireActor(req), String(req.params.id), String(req.body.message));
  sendSuccess(res, 201, 'Inquiry sent successfully', { inquiry });
};

export const myInquiryController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Inquiry fetched successfully', { inquiry: await getMyInquiryForListing(requireActor(req), String(req.params.id)) });
};

/** Public: records a product view. Stores no personal data and never fails the page. */
export const recordListingViewController = async (req: Request, res: Response): Promise<void> => {
  const result = await recordListingView({
    listingId: String(req.params.id),
    ip: String(req.header('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.ip || '',
    userAgent: String(req.header('user-agent') ?? '').slice(0, 300),
    viewerUserId: req.auth?.userId
  });
  sendSuccess(res, 200, 'Event recorded', result);
};
