import { randomBytes } from 'node:crypto';

import type { PaymentOrder, Prisma } from '@prisma/client';

import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { LOCKED_TRANSACTION_OPTIONS, lockForTransaction } from '../utils/advisory-lock';
import { ApiError } from '../utils/api-error';
import { assertBoostableHouse, boostEnd, getBoostPricePerDay, MAX_BOOST_DAYS_PER_ORDER, nextBoostStart } from './boost.service';
import {
  assertBoostableListing,
  getListingBoostPricePerDay,
  getSellerEffectivePlan,
  LISTING_BOOST_DAY_OPTIONS,
  listingBoostEnd,
  nextListingBoostStart,
  SELLER_PLAN_AUDIENCE
} from './marketplace-plan.service';
import { addMonths, AGENT_ORDER_KINDS, FREE_PLAN_CODE, getEffectivePlan, PLAN_AUDIENCE, SELLER_ORDER_KINDS } from './subscription.service';

export const PAYMENT_CURRENCY = 'MMK';
export const DEMO_PROVIDER = 'demo';
const ORDER_LIFETIME_MS = 30 * 60 * 1000;
const BILLING_OPTIONS = [1, 3] as const;

export type PaymentOutcome = 'SUCCESS' | 'PENDING' | 'FAILED';

/**
 * A verified payment notification. Real gateways must build this on the server from a
 * signature-checked callback; nothing in it may come straight from the browser.
 */
export interface PaymentEvent {
  provider: string;
  /** Unique per notification; processing the same id twice has no further effect. */
  eventId: string;
  reference: string;
  outcome: PaymentOutcome;
  amountMmk: number;
  currency: string;
}

/**
 * Integration point for future gateways (KBZPay, WavePay, ...). A provider only decides
 * whether it can take orders in this environment; activation always goes through
 * processPaymentEvent with an event the server has verified.
 */
export interface PaymentProvider {
  name: string;
  isDemo: boolean;
  isAvailable(): boolean;
}

/** Simulated payments for demos and tests. Refused outright in production. */
export const demoPaymentProvider: PaymentProvider = {
  name: DEMO_PROVIDER,
  isDemo: true,
  isAvailable: () => env.demoPaymentsEnabled && env.nodeEnv !== 'production'
};

const providers: PaymentProvider[] = [demoPaymentProvider];

/**
 * Demo checkout for Marketplace seller orders only. Available wherever general demo payments are,
 * and additionally on a deployed site when MARKETPLACE_DEMO_PURCHASE_ENABLED=true. It never applies
 * to agent plans or boosts.
 */
export const isMarketplaceDemoAvailable = (): boolean => demoPaymentProvider.isAvailable() || env.marketplaceDemoPurchaseEnabled;

const isMarketplaceOrderKind = (kind: string) => (SELLER_ORDER_KINDS as readonly string[]).includes(kind);

const pickProvider = (scope: 'agent' | 'marketplace' = 'agent'): PaymentProvider => {
  const provider = providers.find((item) => item.isAvailable());
  if (provider) {
    return provider;
  }
  if (scope === 'marketplace' && env.marketplaceDemoPurchaseEnabled) {
    return demoPaymentProvider;
  }
  throw new ApiError(
    503,
    'PAYMENTS_UNAVAILABLE',
    scope === 'marketplace'
      ? 'Online payment is not available yet. No payment provider is connected and the Marketplace demo checkout is turned off (MARKETPLACE_DEMO_PURCHASE_ENABLED).'
      : 'Online payment is not available yet.'
  );
};

const newReference = (): string => `SM-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;

export const serializeOrder = (order: PaymentOrder & { plan?: { code: string; name: string } | null }) => ({
  reference: order.reference,
  kind: order.kind,
  plan: order.plan ? { code: order.plan.code, name: order.plan.name } : null,
  billingMonths: order.billingMonths,
  houseId: order.houseId,
  listingId: order.listingId,
  boostDays: order.boostDays,
  amountMmk: order.amountMmk,
  currency: order.currency,
  status: order.status,
  isDemo: order.isDemo,
  provider: order.provider,
  expiresAt: order.expiresAt,
  paidAt: order.paidAt,
  createdAt: order.createdAt
});

/** The price always comes from the plan catalogue; the client only names the plan and period. */
export const createSubscriptionOrder = async (userId: string, planCode: string, billingMonths: number, now = new Date()) => {
  if (!BILLING_OPTIONS.includes(billingMonths as (typeof BILLING_OPTIONS)[number])) {
    throw new ApiError(400, 'BILLING_PERIOD_INVALID', 'Choose a 1-month or 3-month period.');
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
  // Only agent plans are sold here; Marketplace seller plans have their own checkout.
  if (!plan || !plan.isActive || plan.code === FREE_PLAN_CODE || plan.audience !== PLAN_AUDIENCE.AGENT) {
    throw new ApiError(400, 'PLAN_INVALID', 'Choose a paid plan from the list.');
  }

  const amountMmk = billingMonths === 3 ? plan.quarterlyPriceMmk : plan.monthlyPriceMmk;
  if (amountMmk <= 0) {
    throw new ApiError(400, 'PLAN_INVALID', 'This plan cannot be purchased.');
  }

  // A lower plan cannot be bought while a higher one is running; it can be chosen after expiry.
  const current = await getEffectivePlan(userId, now);
  if (current.subscription && plan.rank < current.plan.rank) {
    throw new ApiError(409, 'PLAN_DOWNGRADE_NOT_ALLOWED', `Your ${current.plan.name} plan is still active. You can switch to a lower plan after it ends.`);
  }

  const provider = pickProvider();
  const order = await prisma.paymentOrder.create({
    data: {
      reference: newReference(),
      userId,
      kind: 'SUBSCRIPTION',
      planId: plan.id,
      billingMonths,
      amountMmk,
      currency: PAYMENT_CURRENCY,
      provider: provider.name,
      isDemo: provider.isDemo,
      expiresAt: new Date(now.getTime() + ORDER_LIFETIME_MS)
    },
    include: { plan: true }
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, action: 'PAYMENT_ORDER_CREATED', targetType: 'PaymentOrder', targetId: order.id, metadata: { kind: order.kind, plan: plan.code, billingMonths, amountMmk, isDemo: order.isDemo } }
  });

  return serializeOrder(order);
};

export const createBoostOrder = async (userId: string, houseId: string, days: number, now = new Date()) => {
  if (!Number.isInteger(days) || days < 1 || days > MAX_BOOST_DAYS_PER_ORDER) {
    throw new ApiError(400, 'BOOST_DAYS_INVALID', `Choose between 1 and ${MAX_BOOST_DAYS_PER_ORDER} days.`);
  }

  await assertBoostableHouse(userId, houseId);
  const pricePerDay = await getBoostPricePerDay();
  const provider = pickProvider();

  const order = await prisma.paymentOrder.create({
    data: {
      reference: newReference(),
      userId,
      kind: 'BOOST',
      houseId,
      boostDays: days,
      amountMmk: pricePerDay * days,
      currency: PAYMENT_CURRENCY,
      provider: provider.name,
      isDemo: provider.isDemo,
      expiresAt: new Date(now.getTime() + ORDER_LIFETIME_MS)
    },
    include: { plan: true }
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, action: 'PAYMENT_ORDER_CREATED', targetType: 'PaymentOrder', targetId: order.id, metadata: { kind: order.kind, houseId, days, amountMmk: order.amountMmk, isDemo: order.isDemo } }
  });

  return serializeOrder(order);
};

/** An unpaid, unexpired order for the same thing is reused, so double-clicks never create two payments. */
const findReusableOrder = (userId: string, where: Prisma.PaymentOrderWhereInput, now: Date) =>
  prisma.paymentOrder.findFirst({
    where: { userId, status: 'PENDING', expiresAt: { gt: now }, ...where },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });

/** Marketplace Premium Seller. Monthly billing only; buying again while active queues one renewal. */
export const createSellerSubscriptionOrder = async (userId: string, planCode: string, now = new Date()) => {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.isActive || plan.audience !== SELLER_PLAN_AUDIENCE || plan.monthlyPriceMmk <= 0) {
    throw new ApiError(400, 'PLAN_INVALID', 'Choose a paid seller plan from the list.');
  }

  const current = await getSellerEffectivePlan(userId, now);
  if (current.subscription && plan.rank < current.plan.rank) {
    throw new ApiError(409, 'PLAN_DOWNGRADE_NOT_ALLOWED', `Your ${current.plan.name} plan is still active.`);
  }
  if (current.renewal) {
    throw new ApiError(409, 'RENEWAL_ALREADY_QUEUED', 'Your next period is already paid for. You can renew again once it starts.');
  }

  const provider = pickProvider('marketplace');
  const reusable = await findReusableOrder(userId, { kind: 'SELLER_SUBSCRIPTION', planId: plan.id, provider: provider.name }, now);
  if (reusable) {
    return serializeOrder(reusable);
  }

  const order = await prisma.paymentOrder.create({
    data: {
      reference: newReference(),
      userId,
      kind: 'SELLER_SUBSCRIPTION',
      planId: plan.id,
      billingMonths: 1,
      amountMmk: plan.monthlyPriceMmk,
      currency: PAYMENT_CURRENCY,
      provider: provider.name,
      isDemo: provider.isDemo,
      expiresAt: new Date(now.getTime() + ORDER_LIFETIME_MS)
    },
    include: { plan: true }
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, action: 'PAYMENT_ORDER_CREATED', targetType: 'PaymentOrder', targetId: order.id, metadata: { kind: order.kind, plan: plan.code, amountMmk: order.amountMmk, isDemo: order.isDemo } }
  });

  return serializeOrder(order);
};

/** Paid product boost; the price per day comes from the LISTING_BOOST_PRICE_PER_DAY_MMK setting. */
export const createListingBoostOrder = async (userId: string, listingId: string, days: number, now = new Date()) => {
  if (!LISTING_BOOST_DAY_OPTIONS.includes(days as (typeof LISTING_BOOST_DAY_OPTIONS)[number])) {
    throw new ApiError(400, 'BOOST_DAYS_INVALID', `Choose a boost of ${LISTING_BOOST_DAY_OPTIONS.join(', ')} days.`);
  }

  await assertBoostableListing(userId, listingId);
  const pricePerDay = await getListingBoostPricePerDay();
  const provider = pickProvider('marketplace');

  const reusable = await findReusableOrder(userId, { kind: 'LISTING_BOOST', listingId, boostDays: days, provider: provider.name }, now);
  if (reusable) {
    return serializeOrder(reusable);
  }

  const order = await prisma.paymentOrder.create({
    data: {
      reference: newReference(),
      userId,
      kind: 'LISTING_BOOST',
      listingId,
      boostDays: days,
      amountMmk: pricePerDay * days,
      currency: PAYMENT_CURRENCY,
      provider: provider.name,
      isDemo: provider.isDemo,
      expiresAt: new Date(now.getTime() + ORDER_LIFETIME_MS)
    },
    include: { plan: true }
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, action: 'PAYMENT_ORDER_CREATED', targetType: 'PaymentOrder', targetId: order.id, metadata: { kind: order.kind, listingId, days, amountMmk: order.amountMmk, isDemo: order.isDemo } }
  });

  return serializeOrder(order);
};

/** Orders are only ever visible to the user who created them. */
export const getOwnedOrder = async (userId: string, reference: string) => {
  const order = await prisma.paymentOrder.findUnique({ where: { reference }, include: { plan: true } });
  if (!order || order.userId !== userId) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  return order;
};

/** The agent dashboard's orders only; Marketplace seller orders are handled in My Marketplace. */
export const getOwnedAgentOrder = async (userId: string, reference: string) => {
  const order = await getOwnedOrder(userId, reference);
  if (!(AGENT_ORDER_KINDS as readonly string[]).includes(order.kind)) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  return order;
};

export const listOwnedOrders = async (userId: string) => {
  const orders = await prisma.paymentOrder.findMany({
    where: { userId, kind: { in: [...AGENT_ORDER_KINDS] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  return orders.map(serializeOrder);
};

const activateSubscription = async (tx: Prisma.TransactionClient, order: PaymentOrder, now: Date) => {
  const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: order.planId as string } });
  // An agent order can only ever start an agent plan.
  if (plan.audience !== PLAN_AUDIENCE.AGENT) {
    throw new ApiError(409, 'PLAN_AUDIENCE_MISMATCH', 'This order does not match an agent plan.');
  }
  const billingMonths = order.billingMonths as number;

  // Renewing the same plan extends it from its current end; a different plan starts now.
  const samePlan = await tx.agentSubscription.findFirst({
    where: { userId: order.userId, planId: plan.id, endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' }
  });
  const startsAt = samePlan ? samePlan.endsAt : now;

  const subscription = await tx.agentSubscription.create({
    data: { userId: order.userId, planId: plan.id, billingMonths, startsAt, endsAt: addMonths(startsAt, billingMonths), paymentOrderId: order.id }
  });

  await tx.auditLog.create({
    data: {
      actorUserId: order.userId,
      action: 'AGENT_SUBSCRIPTION_ACTIVATED',
      targetType: 'AgentSubscription',
      targetId: subscription.id,
      metadata: { plan: plan.code, billingMonths, startsAt: startsAt.toISOString(), endsAt: subscription.endsAt.toISOString(), orderReference: order.reference, isDemo: order.isDemo }
    }
  });
};

const activateBoost = async (tx: Prisma.TransactionClient, order: PaymentOrder, now: Date) => {
  const houseId = order.houseId as string;
  const days = order.boostDays as number;
  // The listing may have changed since the order was created.
  await assertBoostableHouse(order.userId, houseId, tx);

  const startsAt = await nextBoostStart(houseId, now, tx);
  const boost = await tx.houseBoost.create({
    data: { houseId, userId: order.userId, source: 'PURCHASED', days, startsAt, endsAt: boostEnd(startsAt, days), paymentOrderId: order.id }
  });

  await tx.auditLog.create({
    data: { actorUserId: order.userId, action: 'HOUSE_BOOST_PURCHASED', targetType: 'House', targetId: houseId, metadata: { days, boostId: boost.id, orderReference: order.reference, isDemo: order.isDemo } }
  });
};

const activateSellerSubscription = async (tx: Prisma.TransactionClient, order: PaymentOrder, now: Date) => {
  const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: order.planId as string } });
  // A Marketplace order can only ever start a Marketplace seller plan.
  if (plan.audience !== SELLER_PLAN_AUDIENCE) {
    throw new ApiError(409, 'PLAN_AUDIENCE_MISMATCH', 'This order does not match a seller plan.');
  }
  const billingMonths = order.billingMonths ?? 1;

  // Renewing extends from the end of the latest period of the same plan; otherwise it starts now.
  const latest = await tx.sellerSubscription.findFirst({
    where: { userId: order.userId, planId: plan.id, endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' }
  });
  const startsAt = latest ? latest.endsAt : now;

  const subscription = await tx.sellerSubscription.create({
    data: { userId: order.userId, planId: plan.id, billingMonths, startsAt, endsAt: addMonths(startsAt, billingMonths), paymentOrderId: order.id }
  });

  await tx.auditLog.create({
    data: {
      actorUserId: order.userId,
      action: 'SELLER_SUBSCRIPTION_ACTIVATED',
      targetType: 'SellerSubscription',
      targetId: subscription.id,
      metadata: { plan: plan.code, startsAt: startsAt.toISOString(), endsAt: subscription.endsAt.toISOString(), orderReference: order.reference, isDemo: order.isDemo }
    }
  });
};

const activateListingBoost = async (tx: Prisma.TransactionClient, order: PaymentOrder, now: Date) => {
  const listingId = order.listingId as string;
  const days = order.boostDays as number;
  // The product may have been sold or removed since the order was created.
  await assertBoostableListing(order.userId, listingId, tx);

  const startsAt = await nextListingBoostStart(listingId, now, tx);
  const boost = await tx.listingBoost.create({
    data: { listingId, userId: order.userId, source: 'PURCHASED', days, startsAt, endsAt: listingBoostEnd(startsAt, days), paymentOrderId: order.id }
  });

  await tx.auditLog.create({
    data: { actorUserId: order.userId, action: 'LISTING_BOOST_PURCHASED', targetType: 'Listing', targetId: listingId, metadata: { days, boostId: boost.id, orderReference: order.reference, isDemo: order.isDemo } }
  });
};

export type PaymentEventResult = 'APPLIED' | 'RECORDED' | 'DUPLICATE';

/**
 * The single place where a payment can change an order. Safe to call repeatedly:
 * - the same eventId is processed once;
 * - only a PENDING, unexpired order can become PAID, guarded by a conditional update,
 *   so two simultaneous notifications cannot both activate it;
 * - the notified amount and currency must equal what the server stored on the order.
 * Activation and the status change commit together or not at all.
 */
export const processPaymentEvent = async (event: PaymentEvent, now = new Date()): Promise<{ result: PaymentEventResult; status: string }> => {
  const outcome = await prisma.$transaction(async (tx) => {
    // Notifications for the same order are handled one at a time, so a repeat always sees
    // what the first one did.
    await lockForTransaction(tx, `payment-order:${event.reference}`);

    const seen = await tx.paymentTransaction.findUnique({ where: { eventId: event.eventId }, include: { order: true } });
    if (seen) {
      return { result: 'DUPLICATE' as const, status: seen.order.status };
    }

    const order = await tx.paymentOrder.findUnique({ where: { reference: event.reference } });
    if (!order || order.provider !== event.provider) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    const record = (result: string) =>
      tx.paymentTransaction.create({
        data: { orderId: order.id, provider: event.provider, eventId: event.eventId, outcome: event.outcome, amountMmk: event.amountMmk, isDemo: order.isDemo, result }
      });

    if (event.amountMmk !== order.amountMmk || event.currency !== order.currency) {
      await record('REJECTED');
      return { result: 'RECORDED' as const, status: order.status, rejected: 'PAYMENT_AMOUNT_MISMATCH' as const };
    }

    if (order.status !== 'PENDING') {
      // Already paid, failed or expired: note the event, change nothing.
      await record('RECORDED');
      return { result: 'RECORDED' as const, status: order.status };
    }

    if (order.expiresAt <= now) {
      await tx.paymentOrder.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      await record('REJECTED');
      return { result: 'RECORDED' as const, status: 'EXPIRED', rejected: 'ORDER_EXPIRED' as const };
    }

    if (event.outcome === 'PENDING') {
      await record('RECORDED');
      return { result: 'RECORDED' as const, status: order.status };
    }

    if (event.outcome === 'FAILED') {
      await tx.paymentOrder.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      await record('RECORDED');
      await tx.auditLog.create({ data: { actorUserId: order.userId, action: 'PAYMENT_ORDER_FAILED', targetType: 'PaymentOrder', targetId: order.id, metadata: { reference: order.reference, isDemo: order.isDemo } } });
      return { result: 'RECORDED' as const, status: 'FAILED' };
    }

    const claimed = await tx.paymentOrder.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'PAID', paidAt: now } });
    if (claimed.count !== 1) {
      await record('RECORDED');
      return { result: 'RECORDED' as const, status: 'PAID' };
    }

    if (order.kind === 'SUBSCRIPTION') {
      await activateSubscription(tx, order, now);
    } else if (order.kind === 'SELLER_SUBSCRIPTION') {
      await activateSellerSubscription(tx, order, now);
    } else if (order.kind === 'LISTING_BOOST') {
      await activateListingBoost(tx, order, now);
    } else {
      await activateBoost(tx, order, now);
    }

    await record('APPLIED');
    await tx.auditLog.create({ data: { actorUserId: order.userId, action: 'PAYMENT_ORDER_PAID', targetType: 'PaymentOrder', targetId: order.id, metadata: { reference: order.reference, amountMmk: order.amountMmk, isDemo: order.isDemo } } });
    return { result: 'APPLIED' as const, status: 'PAID' };
  }, LOCKED_TRANSACTION_OPTIONS);

  if ('rejected' in outcome && outcome.rejected === 'PAYMENT_AMOUNT_MISMATCH') {
    throw new ApiError(409, 'PAYMENT_AMOUNT_MISMATCH', 'The payment does not match this order.');
  }
  if ('rejected' in outcome && outcome.rejected === 'ORDER_EXPIRED') {
    throw new ApiError(409, 'ORDER_EXPIRED', 'This order has expired. Please start again.');
  }

  return { result: outcome.result, status: outcome.status };
};

/**
 * Demo checkout: the signed-in owner picks an outcome for their own order. The amount is
 * read from the stored order, never from the request, and the whole endpoint refuses to
 * run unless demo payments are enabled outside production.
 */
export const simulateDemoPayment = async (userId: string, reference: string, outcome: PaymentOutcome, now = new Date()) => {
  if (!demoPaymentProvider.isAvailable() && !env.marketplaceDemoPurchaseEnabled) {
    throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  }

  const order = await getOwnedOrder(userId, reference);
  // On a deployed site only the Marketplace demo checkout may run; agent orders stay real-payment only.
  if (!demoPaymentProvider.isAvailable() && !isMarketplaceOrderKind(order.kind)) {
    throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  }
  if (!order.isDemo || order.provider !== DEMO_PROVIDER) {
    throw new ApiError(409, 'ORDER_NOT_DEMO', 'This order cannot be simulated.');
  }

  // A fixed id per order and outcome: pressing the same button twice is one event.
  const eventId = `demo:${order.id}:${outcome}`;
  const result = await processPaymentEvent(
    { provider: DEMO_PROVIDER, eventId, reference: order.reference, outcome, amountMmk: order.amountMmk, currency: order.currency },
    now
  );

  return { ...result, order: serializeOrder(await getOwnedOrder(userId, reference)) };
};

/**
 * Demo only: ends the agent's demo-paid subscriptions now, so they are back on Free Basic and
 * can try another plan. Subscriptions paid through a real provider are never touched, and the
 * endpoint does not exist unless demo payments are enabled outside production. Records are
 * kept; only their end (and, for queued ones, start) is moved to now.
 */
export const resetDemoSubscriptions = async (userId: string, now = new Date()) => {
  if (!demoPaymentProvider.isAvailable()) {
    throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  }

  const demoOrders = await prisma.paymentOrder.findMany({ where: { userId, isDemo: true, provider: DEMO_PROVIDER } });
  const demoOrderIds = new Set(demoOrders.map((order) => order.id));
  const subscriptions = await prisma.agentSubscription.findMany({ where: { userId } });
  const toEnd = subscriptions.filter((item) => demoOrderIds.has(item.paymentOrderId) && item.endsAt > now);

  for (const item of toEnd) {
    await prisma.agentSubscription.update({
      where: { id: item.id },
      data: { endsAt: now, ...(item.startsAt > now ? { startsAt: now } : {}) }
    });
  }

  return { ended: toEnd.length };
};

/**
 * Demo only: ends the seller's demo-paid Premium periods now, returning them to Free Seller.
 * Periods paid through a real provider are never touched; records are kept.
 */
export const resetDemoSellerSubscriptions = async (userId: string, now = new Date()) => {
  if (!isMarketplaceDemoAvailable()) {
    throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  }

  const subscriptions = await prisma.sellerSubscription.findMany({
    where: { userId, endsAt: { gt: now }, paymentOrder: { isDemo: true, provider: DEMO_PROVIDER } }
  });
  for (const item of subscriptions) {
    await prisma.sellerSubscription.update({ where: { id: item.id }, data: { endsAt: now, ...(item.startsAt > now ? { startsAt: now } : {}) } });
  }
  return { ended: subscriptions.length };
};
