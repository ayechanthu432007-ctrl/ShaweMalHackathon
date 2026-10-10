import { randomBytes } from 'node:crypto';

import type { PaymentOrder, Prisma } from '@prisma/client';

import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { LOCKED_TRANSACTION_OPTIONS, lockForTransaction } from '../utils/advisory-lock';
import { ApiError } from '../utils/api-error';
import { assertBoostableHouse, boostEnd, getBoostPricePerDay, MAX_BOOST_DAYS_PER_ORDER, nextBoostStart } from './boost.service';
import { addMonths, FREE_PLAN_CODE, getEffectivePlan } from './subscription.service';

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

const pickProvider = (): PaymentProvider => {
  const provider = providers.find((item) => item.isAvailable());
  if (!provider) {
    throw new ApiError(503, 'PAYMENTS_UNAVAILABLE', 'Online payment is not available yet.');
  }
  return provider;
};

const newReference = (): string => `SM-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;

export const serializeOrder = (order: PaymentOrder & { plan?: { code: string; name: string } | null }) => ({
  reference: order.reference,
  kind: order.kind,
  plan: order.plan ? { code: order.plan.code, name: order.plan.name } : null,
  billingMonths: order.billingMonths,
  houseId: order.houseId,
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
  if (!plan || !plan.isActive || plan.code === FREE_PLAN_CODE) {
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

/** Orders are only ever visible to the user who created them. */
export const getOwnedOrder = async (userId: string, reference: string) => {
  const order = await prisma.paymentOrder.findUnique({ where: { reference }, include: { plan: true } });
  if (!order || order.userId !== userId) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  return order;
};

export const listOwnedOrders = async (userId: string) => {
  const orders = await prisma.paymentOrder.findMany({ where: { userId }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 30 });
  return orders.map(serializeOrder);
};

const activateSubscription = async (tx: Prisma.TransactionClient, order: PaymentOrder, now: Date) => {
  const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: order.planId as string } });
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
  if (!demoPaymentProvider.isAvailable()) {
    throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  }

  const order = await getOwnedOrder(userId, reference);
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
