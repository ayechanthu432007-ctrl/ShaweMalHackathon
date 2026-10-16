import request from 'supertest';

import { signJwt } from '../../src/utils/jwt';

/** Small in-memory stand-in for the tables the subscription features touch. */
const db = {
  plans: [] as any[],
  subscriptions: [] as any[],
  orders: [] as any[],
  transactions: [] as any[],
  boosts: [] as any[],
  houses: [] as any[],
  auditLogs: [] as any[],
  events: [] as any[],
  bookings: [] as any[],
  profiles: [] as any[],
  settings: [] as any[]
};

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${(sequence += 1)}`;

const compare = (value: any, condition: any): boolean => {
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return value instanceof Date && condition instanceof Date ? value.getTime() === condition.getTime() : value === condition;
  }
  return Object.entries(condition).every(([operator, expected]: [string, any]) => {
    if (operator === 'gt') return value > expected;
    if (operator === 'gte') return value >= expected;
    if (operator === 'lt') return value < expected;
    if (operator === 'lte') return value <= expected;
    if (operator === 'not') return value !== expected;
    if (operator === 'in') return expected.includes(value);
    return true;
  });
};

const matches = (row: any, where: any = {}): boolean =>
  Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === 'AND') return condition.every((item: any) => matches(row, item));
    if (key === 'house') {
      const house = db.houses.find((item) => item.id === row.houseId);
      return Boolean(house) && matches(house, condition);
    }
    return compare(row[key], condition);
  });

const withPlan = (row: any) => (row ? { ...row, plan: db.plans.find((plan) => plan.id === row.planId) ?? null } : row);

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    $executeRaw: jest.fn(async () => 1),
    subscriptionPlan: {
      findUnique: jest.fn(async ({ where }: any) => db.plans.find((plan) => matches(plan, where)) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => db.plans.find((plan) => matches(plan, where))),
      findMany: jest.fn(async ({ where }: any = {}) => db.plans.filter((plan) => matches(plan, where)).sort((a, b) => a.rank - b.rank))
    },
    agentSubscription: {
      findMany: jest.fn(async ({ where }: any) => db.subscriptions.filter((item) => matches(item, where)).map(withPlan)),
      findFirst: jest.fn(async ({ where }: any) => {
        const found = db.subscriptions.filter((item) => matches(item, where)).sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
        return found[0] ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        if (db.subscriptions.some((item) => item.paymentOrderId === data.paymentOrderId)) throw new Error('unique paymentOrderId');
        const row = { id: nextId('sub'), createdAt: new Date(), ...data };
        db.subscriptions.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = db.subscriptions.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      })
    },
    paymentOrder: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('order'), status: 'PENDING', paidAt: null, planId: null, billingMonths: null, houseId: null, boostDays: null, createdAt: new Date(), ...data };
        db.orders.push(row);
        return withPlan(row);
      }),
      findUnique: jest.fn(async ({ where }: any) => withPlan(db.orders.find((order) => matches(order, where)) ?? null)),
      findMany: jest.fn(async ({ where }: any) => db.orders.filter((order) => matches(order, where)).map(withPlan)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = db.orders.filter((order) => matches(order, where));
        rows.forEach((order) => Object.assign(order, data));
        return { count: rows.length };
      })
    },
    paymentTransaction: {
      findUnique: jest.fn(async ({ where }: any) => {
        const row = db.transactions.find((item) => item.eventId === where.eventId);
        return row ? { ...row, order: db.orders.find((order) => order.id === row.orderId) } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        if (db.transactions.some((item) => item.eventId === data.eventId)) throw new Error('unique eventId');
        const row = { id: nextId('tx'), ...data };
        db.transactions.push(row);
        return row;
      })
    },
    houseBoost: {
      findFirst: jest.fn(async ({ where }: any) => {
        const found = db.boosts.filter((boost) => matches(boost, where)).sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
        return found[0] ?? null;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        db.boosts.filter((boost) => matches(boost, where)).map((boost) => ({ ...boost, house: db.houses.find((house) => house.id === boost.houseId) }))
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('boost'), cancelledAt: null, subscriptionId: null, paymentOrderId: null, ...data };
        db.boosts.push(row);
        return row;
      }),
      aggregate: jest.fn(async ({ where }: any) => ({
        _sum: { days: db.boosts.filter((boost) => matches(boost, where)).reduce((sum, boost) => sum + boost.days, 0) || null }
      })),
      count: jest.fn(async ({ where }: any) => db.boosts.filter((boost) => matches(boost, where)).length),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = db.boosts.filter((boost) => matches(boost, where));
        rows.forEach((boost) => Object.assign(boost, data));
        return { count: rows.length };
      })
    },
    house: {
      findUnique: jest.fn(async ({ where }: any) => db.houses.find((house) => house.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) => db.houses.filter((house) => matches(house, where))),
      count: jest.fn(async ({ where }: any) => db.houses.filter((house) => matches(house, where)).length)
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('audit'), createdAt: new Date(), ...data };
        db.auditLogs.push(row);
        return row;
      }),
      count: jest.fn(async ({ where }: any) => db.auditLogs.filter((log) => matches(log, where)).length)
    },
    appSetting: { findUnique: jest.fn(async ({ where }: any) => db.settings.find((item) => item.key === where.key) ?? null) },
    agentProfile: { findUnique: jest.fn(async ({ where }: any) => db.profiles.find((item) => item.userId === where.userId) ?? null) },
    booking: { findMany: jest.fn(async () => db.bookings) },
    houseEvent: {
      createMany: jest.fn(async ({ data }: any) => {
        let count = 0;
        for (const row of data) {
          const duplicate = db.events.some((item) => item.houseId === row.houseId && item.type === row.type && item.visitorKey === row.visitorKey && item.day === row.day);
          if (!duplicate) {
            db.events.push(row);
            count += 1;
          }
        }
        return { count };
      }),
      groupBy: jest.fn(async ({ by, where }: any) => {
        const groups = new Map<string, any>();
        for (const event of db.events.filter((item) => matches(item, where))) {
          const key = by.map((field: string) => event[field]).join('|');
          if (!groups.has(key)) groups.set(key, { ...Object.fromEntries(by.map((field: string) => [field, event[field]])), _count: { _all: 0 } });
          groups.get(key)._count._all += 1;
        }
        return [...groups.values()];
      })
    }
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return { prisma };
});

import { app } from '../../src/app';
import { env } from '../../src/config/env';
import { getAgentDashboard, getAgentPerformance, recordHouseEvent } from '../../src/services/agent-analytics.service';
import { applyFreeBoost, getFreeBoostBalance } from '../../src/services/boost.service';
import { createBoostOrder, createSubscriptionOrder, processPaymentEvent, resetDemoSubscriptions, simulateDemoPayment } from '../../src/services/payment.service';
import { assertListingAllowance, assertPlanFeature, getEffectivePlan, LISTING_CREATED_ACTION, yangonMonthRange } from '../../src/services/subscription.service';

const NOW = new Date('2026-10-09T05:00:00.000Z');
const AGENT = 'agent-1';
const settings = env as unknown as { demoPaymentsEnabled: boolean; nodeEnv: string };

const bearer = (userId: string, roles: string[]) => `Bearer ${signJwt({ sub: userId, email: `${userId}@example.com`, roles }, '1h')}`;

const logListings = (userId: string, count: number, createdAt = NOW) => {
  for (let index = 0; index < count; index += 1) {
    db.auditLogs.push({ id: nextId('audit'), actorUserId: userId, action: LISTING_CREATED_ACTION, createdAt });
  }
};

/** Buys a plan through the demo checkout, exactly as the API does. */
const buy = async (planCode: string, months: number, at = NOW, userId = AGENT) => {
  const order = await createSubscriptionOrder(userId, planCode, months, at);
  await simulateDemoPayment(userId, order.reference, 'SUCCESS', at);
  return order;
};

beforeEach(() => {
  Object.values(db).forEach((table) => (table.length = 0));
  settings.demoPaymentsEnabled = true;
  settings.nodeEnv = 'test';
  const base = { isActive: true, audience: 'AGENT', badgeEligible: false, audienceInsights: false, monthlyReport: false, freeBoostDays: 0 };
  db.plans.push(
    { ...base, id: 'plan_free', code: 'FREE', name: 'Free Basic', rank: 0, monthlyPriceMmk: 0, quarterlyPriceMmk: 0, monthlyListingLimit: 5, performanceLevel: 'BASIC' },
    { ...base, id: 'plan_silver', code: 'SILVER', name: 'Silver Partner', rank: 1, monthlyPriceMmk: 90000, quarterlyPriceMmk: 243000, monthlyListingLimit: 15, freeBoostDays: 3, badgeEligible: true, performanceLevel: 'OVERVIEW' },
    { ...base, id: 'plan_gold', code: 'GOLD', name: 'Gold Premium', rank: 2, monthlyPriceMmk: 160000, quarterlyPriceMmk: 432000, monthlyListingLimit: null, freeBoostDays: 10, badgeEligible: true, performanceLevel: 'DETAILED', audienceInsights: true, monthlyReport: true }
  );
  db.settings.push({ key: 'BOOST_PRICE_PER_DAY_MMK', value: '5000' });
  db.houses.push(
    { id: 'house-1', agentId: AGENT, title: 'Condo', availability: 'AVAILABLE', createdAt: new Date('2026-01-01') },
    { id: 'house-2', agentId: AGENT, title: 'Apartment', availability: 'AVAILABLE', createdAt: new Date('2026-01-01') },
    { id: 'house-other', agentId: 'agent-2', title: 'Someone else', availability: 'AVAILABLE', createdAt: new Date('2026-01-01') }
  );
  db.profiles.push({ userId: AGENT, verificationStatus: 'VERIFIED', rejectionReason: null, reviewedAt: null });
});

describe('monthly listing allowance', () => {
  it('stops a Free agent at 5 new listings', async () => {
    logListings(AGENT, 4);
    await expect(assertListingAllowance(AGENT, NOW)).resolves.toBeUndefined();
    logListings(AGENT, 1);
    await expect(assertListingAllowance(AGENT, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'LISTING_LIMIT_REACHED' });
  });

  it('stops a Silver agent at 15 new listings', async () => {
    await buy('SILVER', 1);
    logListings(AGENT, 14);
    await expect(assertListingAllowance(AGENT, NOW)).resolves.toBeUndefined();
    logListings(AGENT, 1);
    await expect(assertListingAllowance(AGENT, NOW)).rejects.toMatchObject({ code: 'LISTING_LIMIT_REACHED' });
  });

  it('gives Gold agents no plan-based limit', async () => {
    await buy('GOLD', 1);
    logListings(AGENT, 200);
    await expect(assertListingAllowance(AGENT, NOW)).resolves.toBeUndefined();
  });

  it('resets at midnight Asia/Yangon on the first of the month, and deleting a listing does not free a slot', async () => {
    expect(yangonMonthRange(new Date('2026-10-31T17:29:59.000Z')).month).toBe('2026-10');
    expect(yangonMonthRange(new Date('2026-10-31T17:30:00.000Z')).month).toBe('2026-11');

    // Five listings logged in October (already deleted: no house rows exist for them).
    logListings(AGENT, 5, new Date('2026-10-20T03:00:00.000Z'));
    await expect(assertListingAllowance(AGENT, new Date('2026-10-31T17:29:59.000Z'))).rejects.toMatchObject({ code: 'LISTING_LIMIT_REACHED' });
    await expect(assertListingAllowance(AGENT, new Date('2026-10-31T17:30:00.000Z'))).resolves.toBeUndefined();
  });
});

describe('demo payments and activation', () => {
  it('uses the server price and never activates on pending or failed payments', async () => {
    const order = await createSubscriptionOrder(AGENT, 'SILVER', 3, NOW);
    expect(order).toMatchObject({ amountMmk: 243000, currency: 'MMK', status: 'PENDING', isDemo: true });

    await simulateDemoPayment(AGENT, order.reference, 'PENDING', NOW);
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('FREE');

    const failed = await simulateDemoPayment(AGENT, order.reference, 'FAILED', NOW);
    expect(failed.order.status).toBe('FAILED');
    // A failed order cannot be paid afterwards; a new order is needed.
    await simulateDemoPayment(AGENT, order.reference, 'SUCCESS', NOW);
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('FREE');
    expect(db.subscriptions).toHaveLength(0);
  });

  it('activates the right plan and period on a valid payment and records the audit trail', async () => {
    const order = await buy('GOLD', 3);

    const effective = await getEffectivePlan(AGENT, NOW);
    expect(effective.plan.code).toBe('GOLD');
    expect(effective.subscription?.startsAt.toISOString()).toBe(NOW.toISOString());
    expect(effective.subscription?.endsAt.toISOString()).toBe('2027-01-09T05:00:00.000Z');
    expect(db.orders[0]).toMatchObject({ status: 'PAID', amountMmk: 432000 });
    expect(db.transactions).toEqual([expect.objectContaining({ outcome: 'SUCCESS', result: 'APPLIED', isDemo: true })]);
    expect(db.auditLogs.map((log) => log.action)).toEqual(expect.arrayContaining(['PAYMENT_ORDER_CREATED', 'AGENT_SUBSCRIPTION_ACTIVATED', 'PAYMENT_ORDER_PAID']));
    expect(order.reference).toMatch(/^SM-[A-Z0-9]+-[A-F0-9]{8}$/);
  });

  it('does not activate or extend twice on duplicate notifications', async () => {
    const order = await buy('SILVER', 1);
    const event = { provider: 'demo', reference: order.reference, outcome: 'SUCCESS' as const, amountMmk: 90000, currency: 'MMK' };

    expect((await simulateDemoPayment(AGENT, order.reference, 'SUCCESS', NOW)).result).toBe('DUPLICATE');
    expect((await processPaymentEvent({ ...event, eventId: 'retry-1' }, NOW)).result).toBe('RECORDED');
    await Promise.all([processPaymentEvent({ ...event, eventId: 'retry-2' }, NOW), processPaymentEvent({ ...event, eventId: 'retry-3' }, NOW)]);

    expect(db.subscriptions).toHaveLength(1);
    expect(db.subscriptions[0].endsAt.toISOString()).toBe('2026-11-09T05:00:00.000Z');
  });

  it('rejects a payment whose amount or currency differs from the order', async () => {
    const order = await createSubscriptionOrder(AGENT, 'GOLD', 1, NOW);
    const event = { provider: 'demo', reference: order.reference, outcome: 'SUCCESS' as const, amountMmk: 1, currency: 'MMK', eventId: 'cheap' };

    await expect(processPaymentEvent(event, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'PAYMENT_AMOUNT_MISMATCH' });
    await expect(processPaymentEvent({ ...event, amountMmk: 160000, currency: 'USD', eventId: 'usd' }, NOW)).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    expect(db.orders[0].status).toBe('PENDING');
    expect(db.subscriptions).toHaveLength(0);
  });

  it('rejects expired orders, unknown plans, the free plan and other periods', async () => {
    const order = await createSubscriptionOrder(AGENT, 'SILVER', 1, NOW);
    const later = new Date(NOW.getTime() + 31 * 60 * 1000);
    await expect(simulateDemoPayment(AGENT, order.reference, 'SUCCESS', later)).rejects.toMatchObject({ code: 'ORDER_EXPIRED' });
    expect(db.subscriptions).toHaveLength(0);

    await expect(createSubscriptionOrder(AGENT, 'FREE', 1, NOW)).rejects.toMatchObject({ code: 'PLAN_INVALID' });
    await expect(createSubscriptionOrder(AGENT, 'PLATINUM', 1, NOW)).rejects.toMatchObject({ code: 'PLAN_INVALID' });
    await expect(createSubscriptionOrder(AGENT, 'GOLD', 12, NOW)).rejects.toMatchObject({ code: 'BILLING_PERIOD_INVALID' });
  });

  it('renews from the current end date, upgrades immediately and blocks mid-period downgrades', async () => {
    await buy('SILVER', 1);
    await buy('SILVER', 1);
    expect(db.subscriptions.map((item) => item.endsAt.toISOString())).toEqual(['2026-11-09T05:00:00.000Z', '2026-12-09T05:00:00.000Z']);

    await buy('GOLD', 1);
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('GOLD');
    await expect(createSubscriptionOrder(AGENT, 'SILVER', 1, NOW)).rejects.toMatchObject({ code: 'PLAN_DOWNGRADE_NOT_ALLOWED' });

    // When Gold ends, the Silver time already paid for is still there.
    expect((await getEffectivePlan(AGENT, new Date('2026-11-20T00:00:00.000Z'))).plan.code).toBe('SILVER');
  });

  it('returns a demo agent to Free Basic so another plan can be tried, keeping the records', async () => {
    await buy('SILVER', 1);
    await buy('GOLD', 3);
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('GOLD');

    expect(await resetDemoSubscriptions(AGENT, NOW)).toEqual({ ended: 2 });
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('FREE');
    expect(db.subscriptions).toHaveLength(2);

    // After the reset a lower plan can be chosen straight away.
    await buy('SILVER', 1);
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('SILVER');
  });

  it('never resets anything when demo payments are off or in production', async () => {
    await buy('GOLD', 1);
    settings.nodeEnv = 'production';
    await expect(resetDemoSubscriptions(AGENT, NOW)).rejects.toMatchObject({ statusCode: 404 });
    settings.nodeEnv = 'test';
    settings.demoPaymentsEnabled = false;
    await expect(resetDemoSubscriptions(AGENT, NOW)).rejects.toMatchObject({ statusCode: 404 });
    settings.demoPaymentsEnabled = true;
    expect((await getEffectivePlan(AGENT, NOW)).plan.code).toBe('GOLD');
  });

  it('cannot be simulated when demo payments are off or in production, or for someone else', async () => {
    const order = await createSubscriptionOrder(AGENT, 'SILVER', 1, NOW);

    await expect(simulateDemoPayment('agent-2', order.reference, 'SUCCESS', NOW)).rejects.toMatchObject({ statusCode: 404 });

    settings.nodeEnv = 'production';
    await expect(simulateDemoPayment(AGENT, order.reference, 'SUCCESS', NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(createSubscriptionOrder(AGENT, 'SILVER', 1, NOW)).rejects.toMatchObject({ statusCode: 503, code: 'PAYMENTS_UNAVAILABLE' });

    settings.nodeEnv = 'test';
    settings.demoPaymentsEnabled = false;
    await expect(simulateDemoPayment(AGENT, order.reference, 'SUCCESS', NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.subscriptions).toHaveLength(0);
  });
});

describe('expiry, premium access and the verified badge', () => {
  it('drops premium access when the subscription ends', async () => {
    await buy('GOLD', 1);
    await expect(assertPlanFeature(AGENT, 'audienceInsights', NOW)).resolves.toBeDefined();

    const afterExpiry = new Date('2026-11-09T05:00:00.000Z');
    await expect(assertPlanFeature(AGENT, 'audienceInsights', afterExpiry)).rejects.toMatchObject({ statusCode: 403, code: 'PLAN_FEATURE_LOCKED' });
    const dashboard = await getAgentDashboard(AGENT, afterExpiry);
    expect(dashboard.plan.code).toBe('FREE');
    expect(dashboard.subscription.status).toBe('EXPIRED');
    expect(dashboard.freeBoost.remaining).toBe(0);
  });

  it('shows the badge only with admin approval and an eligible plan; paying never verifies', async () => {
    expect((await getAgentDashboard(AGENT, NOW)).verification).toMatchObject({ status: 'VERIFIED', badgeShown: false });

    db.profiles[0].verificationStatus = 'PENDING';
    await buy('GOLD', 1);
    expect(db.profiles[0].verificationStatus).toBe('PENDING');
    expect((await getAgentDashboard(AGENT, NOW)).verification).toMatchObject({ status: 'PENDING', badgeEligiblePlan: true, badgeShown: false });

    db.profiles[0].verificationStatus = 'VERIFIED';
    expect((await getAgentDashboard(AGENT, NOW)).verification.badgeShown).toBe(true);
  });

  it('gives each plan its own level of performance detail', async () => {
    expect(await getAgentPerformance(AGENT, 90, NOW)).toMatchObject({ level: 'BASIC', rangeDays: 30, series: null, listings: null });

    await buy('SILVER', 1);
    const silver = await getAgentPerformance(AGENT, 90, NOW);
    expect(silver).toMatchObject({ level: 'OVERVIEW', rangeDays: 30, listings: null });
    expect(silver.series).toHaveLength(30);

    await buy('GOLD', 1);
    const gold = await getAgentPerformance(AGENT, 90, NOW);
    expect(gold).toMatchObject({ level: 'DETAILED', rangeDays: 90 });
    expect(gold.listings).toHaveLength(2);
  });
});

describe('boosts', () => {
  it('grants free days once per paid period and spends them as the agent chooses', async () => {
    await expect(applyFreeBoost(AGENT, 'house-1', 1, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'PLAN_FEATURE_LOCKED' });

    await buy('SILVER', 1);
    expect(await getFreeBoostBalance(AGENT, NOW)).toMatchObject({ granted: 3, used: 0, remaining: 3 });

    const boost = await applyFreeBoost(AGENT, 'house-1', 2, NOW);
    expect(boost.endsAt.toISOString()).toBe('2026-10-11T05:00:00.000Z');
    expect(await getFreeBoostBalance(AGENT, NOW)).toMatchObject({ used: 2, remaining: 1 });

    await expect(applyFreeBoost(AGENT, 'house-1', 2, NOW)).rejects.toMatchObject({ code: 'FREE_BOOST_INSUFFICIENT' });
    await expect(applyFreeBoost(AGENT, 'house-2', 1, NOW)).rejects.toMatchObject({ code: 'FREE_BOOST_ALREADY_RUNNING' });
    await expect(applyFreeBoost(AGENT, 'house-other', 1, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'HOUSE_FORBIDDEN' });

    // The remaining day queues after the running boost instead of overlapping it.
    const extra = await applyFreeBoost(AGENT, 'house-1', 1, NOW);
    expect(extra.startsAt.toISOString()).toBe('2026-10-11T05:00:00.000Z');
    expect((await getFreeBoostBalance(AGENT, NOW)).remaining).toBe(0);
  });

  it('sells Per-Day Boost at the server price and applies it once', async () => {
    const order = await createBoostOrder(AGENT, 'house-1', 4, NOW);
    expect(order).toMatchObject({ kind: 'BOOST', amountMmk: 20000, boostDays: 4 });

    await simulateDemoPayment(AGENT, order.reference, 'SUCCESS', NOW);
    await simulateDemoPayment(AGENT, order.reference, 'SUCCESS', NOW);
    expect(db.boosts).toEqual([expect.objectContaining({ houseId: 'house-1', source: 'PURCHASED', days: 4 })]);

    await expect(createBoostOrder(AGENT, 'house-other', 1, NOW)).rejects.toMatchObject({ code: 'HOUSE_FORBIDDEN' });
    await expect(createBoostOrder(AGENT, 'house-1', 0, NOW)).rejects.toMatchObject({ code: 'BOOST_DAYS_INVALID' });
    db.houses[1].availability = 'RENTED';
    await expect(createBoostOrder(AGENT, 'house-2', 1, NOW)).rejects.toMatchObject({ code: 'HOUSE_NOT_BOOSTABLE' });
  });
});

describe('view and contact tracking', () => {
  it('counts one view per visitor per listing per day and ignores the owner', async () => {
    const visit = { houseId: 'house-1', type: 'VIEW' as const, ip: '10.0.0.1', userAgent: 'phone' };
    expect((await recordHouseEvent(visit, NOW)).recorded).toBe(true);
    expect((await recordHouseEvent(visit, NOW)).recorded).toBe(false);
    expect((await recordHouseEvent({ ...visit, ip: '10.0.0.2' }, NOW)).recorded).toBe(true);
    expect((await recordHouseEvent({ ...visit, type: 'CALL' }, NOW)).recorded).toBe(true);
    expect((await recordHouseEvent({ ...visit, ip: '10.0.0.9', viewerUserId: AGENT }, NOW)).recorded).toBe(false);

    const dashboard = await getAgentDashboard(AGENT, NOW);
    expect(dashboard.last30Days).toMatchObject({ views: 2, calls: 1, inquiries: 1 });
    expect(JSON.stringify(db.events)).not.toContain('10.0.0.1');
  });
});

describe('agent and Marketplace seller plans stay separate', () => {
  it('lists only agent plans for the agent subscription page', async () => {
    const { prisma } = jest.requireMock('../../src/prisma/client');
    const { listPlans } = await import('../../src/services/subscription.service');
    await listPlans();
    expect(prisma.subscriptionPlan.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { isActive: true, audience: 'AGENT' } }));
  });

  it('shows agents only Free Basic, Silver Partner and Gold Premium even when seller plans exist', async () => {
    db.plans.push({ id: 'plan_seller_free', code: 'SELLER_FREE', name: 'Free Seller', rank: 0, isActive: true, audience: 'SELLER', monthlyPriceMmk: 0, quarterlyPriceMmk: 0 });
    const response = await request(app).get('/api/v1/agent/dashboard').set('Authorization', bearer(AGENT, ['agent']));
    expect(response.status).toBe(200);
    expect(response.body.data.dashboard.plans.map((plan: any) => plan.code)).toEqual(['FREE', 'SILVER', 'GOLD']);
  });

  it('does not let the agent checkout read or pay a Marketplace seller order', async () => {
    db.plans.push({ id: 'plan_seller_premium', code: 'SELLER_PREMIUM', name: 'Premium Seller', rank: 1, isActive: true, audience: 'SELLER', monthlyPriceMmk: 90000, quarterlyPriceMmk: 0 });
    db.orders.push({ id: 'order-seller', reference: 'SM-SELLER1-ABCDEF12', userId: AGENT, kind: 'SELLER_SUBSCRIPTION', planId: 'plan_seller_premium', billingMonths: 1, amountMmk: 90000, currency: 'MMK', status: 'PENDING', provider: 'demo', isDemo: true, expiresAt: new Date(Date.now() + 600_000), createdAt: new Date() });
    const read = await request(app).get('/api/v1/agent/payments/orders/SM-SELLER1-ABCDEF12').set('Authorization', bearer(AGENT, ['agent']));
    expect(read.status).toBe(404);
    const pay = await request(app).post('/api/v1/agent/payments/orders/SM-SELLER1-ABCDEF12/demo').set('Authorization', bearer(AGENT, ['agent'])).send({ outcome: 'success' });
    expect(pay.status).toBe(404);
    const list = await request(app).get('/api/v1/agent/payments/orders').set('Authorization', bearer(AGENT, ['agent']));
    expect(list.body.data.items.map((item: any) => item.reference)).not.toContain('SM-SELLER1-ABCDEF12');
    expect(db.subscriptions).toHaveLength(0);
  });

  it('never activates a non-agent plan from an agent order', async () => {
    db.plans.push({ id: 'plan_seller_premium', code: 'SELLER_PREMIUM', name: 'Premium Seller', rank: 1, isActive: true, audience: 'SELLER', monthlyPriceMmk: 90000, quarterlyPriceMmk: 0 });
    // A tampered agent order pointing at a seller plan: the payment is refused and nothing starts.
    db.orders.push({ id: 'order-bad', reference: 'SM-BAD1-ABCDEF12', userId: AGENT, kind: 'SUBSCRIPTION', planId: 'plan_seller_premium', billingMonths: 1, amountMmk: 90000, currency: 'MMK', status: 'PENDING', provider: 'demo', isDemo: true, expiresAt: new Date(NOW.getTime() + 600_000), createdAt: NOW });
    await expect(processPaymentEvent({ provider: 'demo', eventId: 'e-bad', reference: 'SM-BAD1-ABCDEF12', outcome: 'SUCCESS', amountMmk: 90000, currency: 'MMK' }, NOW)).rejects.toMatchObject({ code: 'PLAN_AUDIENCE_MISMATCH' });
    expect(db.subscriptions).toHaveLength(0);
  });

  it('refuses to sell a Marketplace seller plan through the agent checkout', async () => {
    db.plans.push({ id: 'plan_seller_premium', code: 'SELLER_PREMIUM', name: 'Premium Seller', rank: 1, isActive: true, audience: 'SELLER', monthlyPriceMmk: 90000, quarterlyPriceMmk: 0 });
    await expect(createSubscriptionOrder(AGENT, 'SELLER_PREMIUM', 1, NOW)).rejects.toMatchObject({ code: 'PLAN_INVALID' });
  });
});

describe('API access control', () => {
  it('requires a signed-in agent', async () => {
    expect((await request(app).get('/api/v1/agent/dashboard')).status).toBe(401);
    expect((await request(app).get('/api/v1/agent/dashboard').set('Authorization', bearer('user-1', ['normal']))).status).toBe(403);
    expect((await request(app).get('/api/v1/agent/dashboard').set('Authorization', bearer(AGENT, ['agent']))).status).toBe(200);
  });

  it('keeps Gold-only pages from Free and Silver agents, on the server', async () => {
    const agent = bearer(AGENT, ['agent']);
    for (const path of ['/api/v1/agent/insights', '/api/v1/agent/reports/monthly']) {
      expect((await request(app).get(path).set('Authorization', agent)).body.errors.code).toBe('PLAN_FEATURE_LOCKED');
    }

    await buy('SILVER', 1, new Date());
    for (const path of ['/api/v1/agent/insights', '/api/v1/agent/reports/monthly']) {
      const response = await request(app).get(path).set('Authorization', agent);
      expect(response.status).toBe(403);
      expect(response.body.errors.code).toBe('PLAN_FEATURE_LOCKED');
    }

    await buy('GOLD', 1, new Date());
    expect((await request(app).get('/api/v1/agent/insights').set('Authorization', agent)).status).toBe(200);
    expect((await request(app).get('/api/v1/agent/reports/monthly').set('Authorization', agent)).status).toBe(200);
  });

  it('ignores a price, status or user id sent by the client', async () => {
    const agent = bearer(AGENT, ['agent']);
    const created = await request(app)
      .post('/api/v1/agent/subscription/orders')
      .set('Authorization', agent)
      .send({ planCode: 'gold', billingMonths: 1, amountMmk: 1, status: 'PAID', userId: 'agent-2', isDemo: false });

    expect(created.status).toBe(201);
    expect(created.body.data.order).toMatchObject({ amountMmk: 160000, status: 'PENDING', isDemo: true });
    expect(db.orders[0].userId).toBe(AGENT);
    expect(db.subscriptions).toHaveLength(0);

    const reference = created.body.data.order.reference;
    const stranger = await request(app).post(`/api/v1/agent/payments/orders/${reference}/demo`).set('Authorization', bearer('agent-2', ['agent'])).send({ outcome: 'success' });
    expect(stranger.status).toBe(404);
    const bad = await request(app).post(`/api/v1/agent/payments/orders/${reference}/demo`).set('Authorization', agent).send({ outcome: 'paid-please' });
    expect(bad.status).toBe(400);

    const paid = await request(app).post(`/api/v1/agent/payments/orders/${reference}/demo`).set('Authorization', agent).send({ outcome: 'success' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.order.status).toBe('PAID');
    expect(db.subscriptions).toHaveLength(1);
  });

  it('lets only admins see and change plans', async () => {
    expect((await request(app).get('/api/v1/admin/subscriptions').set('Authorization', bearer(AGENT, ['agent']))).status).toBe(403);
    expect((await request(app).patch('/api/v1/admin/subscriptions/plans/GOLD').set('Authorization', bearer(AGENT, ['agent'])).send({ monthlyPriceMmk: 1 })).status).toBe(403);
  });
});
