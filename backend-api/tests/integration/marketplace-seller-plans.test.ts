import request from 'supertest';

import { signJwt } from '../../src/utils/jwt';

/** Small in-memory stand-in for the tables the Seller Dashboard features touch. */
const db = {
  plans: [] as any[],
  subscriptions: [] as any[],
  agentSubscriptions: [] as any[],
  orders: [] as any[],
  transactions: [] as any[],
  boosts: [] as any[],
  listings: [] as any[],
  events: [] as any[],
  inquiries: [] as any[],
  auditLogs: [] as any[],
  notifications: [] as any[],
  settings: [] as any[],
  users: [] as any[]
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

const RELATIONS: Record<string, (row: any) => any> = {
  listing: (row) => db.listings.find((item) => item.id === row.listingId),
  plan: (row) => db.plans.find((item) => item.id === row.planId),
  paymentOrder: (row) => db.orders.find((item) => item.id === row.paymentOrderId),
  seller: (row) => db.users.find((item) => item.id === row.sellerId)
};

const matches = (row: any, where: any = {}): boolean =>
  Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === 'AND') return condition.every((item: any) => matches(row, item));
    if (RELATIONS[key] && !(key in row && typeof row[key] !== 'object')) {
      const related = RELATIONS[key](row);
      return Boolean(related) && matches(related, condition);
    }
    return compare(row[key], condition);
  });

const table = (rows: () => any[], prefix: string, defaults: Record<string, unknown> = {}, include?: (row: any) => any) => {
  const out = (row: any) => (row && include ? { ...row, ...include(row) } : row);
  return {
    findUnique: jest.fn(async ({ where }: any) => out(rows().find((row) => matches(row, where)) ?? null)),
    findUniqueOrThrow: jest.fn(async ({ where }: any) => out(rows().find((row) => matches(row, where)))),
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
      const found = rows().filter((row) => matches(row, where));
      if (orderBy?.endsAt === 'desc') found.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
      if (orderBy?.createdAt === 'desc') found.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return out(found[0] ?? null);
    }),
    findMany: jest.fn(async ({ where }: any = {}) => rows().filter((row) => matches(row, where)).map(out)),
    count: jest.fn(async ({ where }: any = {}) => rows().filter((row) => matches(row, where)).length),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: nextId(prefix), createdAt: new Date(), ...defaults, ...data };
      rows().push(row);
      return out(row);
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows().find((item) => matches(item, where));
      Object.assign(row, data);
      return out(row);
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const found = rows().filter((row) => matches(row, where));
      found.forEach((row) => Object.assign(row, data));
      return { count: found.length };
    })
  };
};

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    $executeRaw: jest.fn(async () => 1),
    subscriptionPlan: table(() => db.plans, 'plan'),
    sellerSubscription: table(() => db.subscriptions, 'sub', {}, (row) => ({ plan: db.plans.find((plan) => plan.id === row.planId) })),
    agentSubscription: table(() => db.agentSubscriptions, 'agentsub', {}, (row) => ({ plan: db.plans.find((plan) => plan.id === row.planId) })),
    paymentOrder: table(() => db.orders, 'order', { status: 'PENDING', paidAt: null, planId: null, billingMonths: null, houseId: null, listingId: null, boostDays: null }, (row) => ({
      plan: db.plans.find((plan) => plan.id === row.planId) ?? null
    })),
    paymentTransaction: {
      ...table(() => db.transactions, 'tx'),
      findUnique: jest.fn(async ({ where }: any) => {
        const row = db.transactions.find((item) => item.eventId === where.eventId);
        return row ? { ...row, order: db.orders.find((order) => order.id === row.orderId) } : null;
      })
    },
    listingBoost: table(() => db.boosts, 'boost', { cancelledAt: null, subscriptionId: null, paymentOrderId: null }, (row) => ({
      listing: db.listings.find((listing) => listing.id === row.listingId)
    })),
    listing: table(() => db.listings, 'listing'),
    listingEvent: {
      ...table(() => db.events, 'event'),
      createMany: jest.fn(async ({ data }: any) => {
        let count = 0;
        for (const row of data) {
          const duplicate = db.events.some((item) => item.listingId === row.listingId && item.type === row.type && item.visitorKey === row.visitorKey && item.day === row.day);
          if (!duplicate) {
            db.events.push({ id: nextId('event'), ...row });
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
    },
    listingInquiry: {
      ...table(() => db.inquiries, 'inquiry', { status: 'NEW', readAt: null, sellerReply: null, repliedAt: null }, (row) => ({
        listing: db.listings.find((listing) => listing.id === row.listingId),
        buyer: db.users.find((user) => user.id === row.buyerId)
      })),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const key = where.listingId_buyerId;
        const existing = db.inquiries.find((item) => item.listingId === key.listingId && item.buyerId === key.buyerId);
        if (existing) return Object.assign(existing, update);
        const row = { id: nextId('inquiry'), status: 'NEW', readAt: null, createdAt: new Date(), ...create };
        db.inquiries.push(row);
        return row;
      }),
      groupBy: jest.fn(async ({ where }: any) => {
        const groups = new Map<string, number>();
        db.inquiries.filter((item) => matches(item, where)).forEach((item) => groups.set(item.status, (groups.get(item.status) ?? 0) + 1));
        return [...groups.entries()].map(([status, count]) => ({ status, _count: { _all: count } }));
      })
    },
    user: table(() => db.users, 'user'),
    auditLog: table(() => db.auditLogs, 'audit'),
    notification: table(() => db.notifications, 'notification'),
    appSetting: table(() => db.settings, 'setting')
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return { prisma };
});

import { app } from '../../src/app';
import { env } from '../../src/config/env';
import { getSellerInsights, recordListingView } from '../../src/services/marketplace-insights.service';
import { claimFreeListingBoost, getListingAllowance, getSellerEffectivePlan, pickBoostedListingIds } from '../../src/services/marketplace-plan.service';
import { createListingBoostOrder, createSellerSubscriptionOrder, createSubscriptionOrder, processPaymentEvent, simulateDemoPayment } from '../../src/services/payment.service';
import { getEffectivePlan } from '../../src/services/subscription.service';

const NOW = new Date('2026-10-16T05:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const SELLER = 'seller-1';
const OTHER = 'seller-2';
const BUYER = 'buyer-1';
const settings = env as unknown as { demoPaymentsEnabled: boolean; nodeEnv: string; marketplaceDemoPurchaseEnabled: boolean };
const bearer = (userId: string) => `Bearer ${signJwt({ sub: userId, email: `${userId}@example.com`, roles: ['normal'] }, '1h')}`;

const addListing = (id: string, sellerId = SELLER, overrides: Record<string, unknown> = {}) => {
  db.listings.push({ id, sellerId, title: `Item ${id}`, status: 'ACTIVE', moderationStatus: 'APPROVED', createdAt: new Date(NOW.getTime() - 10 * DAY), ...overrides });
};

const buyPremium = async (at = NOW, userId = SELLER) => {
  const order = await createSellerSubscriptionOrder(userId, 'SELLER_PREMIUM', at);
  await simulateDemoPayment(userId, order.reference, 'SUCCESS', at);
  return order;
};

beforeEach(() => {
  Object.values(db).forEach((rows) => (rows.length = 0));
  settings.demoPaymentsEnabled = true;
  settings.nodeEnv = 'test';
  settings.marketplaceDemoPurchaseEnabled = false;
  const base = { isActive: true, audience: 'SELLER', quarterlyPriceMmk: 0, monthlyListingLimit: null };
  db.plans.push(
    { ...base, id: 'plan_seller_free', code: 'SELLER_FREE', name: 'Free Seller', rank: 0, monthlyPriceMmk: 0, activeListingLimit: 5, freeBoostDays: 0, badgeEligible: false, performanceLevel: 'BASIC', homepageFeatured: false },
    { ...base, id: 'plan_seller_premium', code: 'SELLER_PREMIUM', name: 'Premium Seller', rank: 1, monthlyPriceMmk: 90000, activeListingLimit: null, freeBoostDays: 3, badgeEligible: true, performanceLevel: 'DETAILED', homepageFeatured: true },
    { id: 'plan_free', code: 'FREE', name: 'Free Basic', rank: 0, isActive: true, audience: 'AGENT', monthlyPriceMmk: 0, quarterlyPriceMmk: 0, monthlyListingLimit: 5 },
    { id: 'plan_gold', code: 'GOLD', name: 'Gold Premium', rank: 2, isActive: true, audience: 'AGENT', monthlyPriceMmk: 160000, quarterlyPriceMmk: 432000 }
  );
  db.settings.push({ key: 'LISTING_BOOST_PRICE_PER_DAY_MMK', value: '2000' });
  db.users.push(
    { id: SELLER, name: 'Seller One', phone: '0911', accountStatus: 'ACTIVE' },
    { id: OTHER, name: 'Seller Two', phone: '0922', accountStatus: 'ACTIVE' },
    { id: BUYER, name: 'Buyer One', phone: '0933', accountStatus: 'ACTIVE' }
  );
});

describe('seller plans', () => {
  it('starts a new seller on Free Seller with a five-product limit', async () => {
    const { plan, subscription } = await getSellerEffectivePlan(SELLER, NOW);
    expect(plan.code).toBe('SELLER_FREE');
    expect(subscription).toBeNull();
    for (const id of ['a', 'b', 'c']) addListing(id);
    addListing('sold', SELLER, { status: 'SOLD' });
    addListing('removed', SELLER, { moderationStatus: 'REMOVED' });
    expect(await getListingAllowance(SELLER, NOW)).toEqual({ planCode: 'SELLER_FREE', used: 3, limit: 5, remaining: 2 });
  });

  it('activates Premium only after a successful payment, at the catalogue price', async () => {
    const order = await createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW);
    expect(order).toMatchObject({ kind: 'SELLER_SUBSCRIPTION', amountMmk: 90000, isDemo: true, status: 'PENDING' });
    expect((await getSellerEffectivePlan(SELLER, NOW)).plan.code).toBe('SELLER_FREE');

    await simulateDemoPayment(SELLER, order.reference, 'PENDING', NOW);
    await simulateDemoPayment(SELLER, order.reference, 'FAILED', NOW);
    expect((await getSellerEffectivePlan(SELLER, NOW)).plan.code).toBe('SELLER_FREE');
    expect(db.subscriptions).toHaveLength(0);

    await buyPremium();
    const effective = await getSellerEffectivePlan(SELLER, NOW);
    expect(effective.plan.code).toBe('SELLER_PREMIUM');
    expect(effective.subscription?.endsAt.toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect((await getListingAllowance(SELLER, NOW)).limit).toBeNull();
    // The state is read from persisted rows, so it survives refresh and re-login and lapses by date alone.
    expect((await getSellerEffectivePlan(SELLER, new Date('2026-11-16T05:00:01.000Z'))).plan.code).toBe('SELLER_FREE');
  });

  it('reuses an unpaid order, queues one renewal and never double-activates', async () => {
    const first = await createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW);
    const second = await createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW);
    expect(second.reference).toBe(first.reference);

    await simulateDemoPayment(SELLER, first.reference, 'SUCCESS', NOW);
    await simulateDemoPayment(SELLER, first.reference, 'SUCCESS', NOW);
    expect(db.subscriptions).toHaveLength(1);

    await buyPremium(new Date(NOW.getTime() + DAY));
    const effective = await getSellerEffectivePlan(SELLER, new Date(NOW.getTime() + 2 * DAY));
    expect(effective.renewal?.startsAt.toISOString()).toBe('2026-11-16T05:00:00.000Z');
    await expect(createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', new Date(NOW.getTime() + 2 * DAY))).rejects.toMatchObject({ code: 'RENEWAL_ALREADY_QUEUED' });
  });

  it('changes only the Marketplace subscription when a seller buys Premium Seller', async () => {
    db.agentSubscriptions.push({ id: 'agent-sub', userId: SELLER, planId: 'plan_gold', billingMonths: 1, startsAt: new Date(NOW.getTime() - 86_400_000), endsAt: new Date(NOW.getTime() + 5 * 86_400_000), paymentOrderId: 'agent-order' });
    const agentBefore = JSON.stringify(db.agentSubscriptions);
    await buyPremium();
    expect(JSON.stringify(db.agentSubscriptions)).toBe(agentBefore);
    expect((await getEffectivePlan(SELLER, NOW)).plan.code).toBe('GOLD');
    expect((await getSellerEffectivePlan(SELLER, NOW)).plan.code).toBe('SELLER_PREMIUM');
  });

  it('keeps an agent plan purchase out of the Marketplace subscription', async () => {
    const order = await createSubscriptionOrder(SELLER, 'GOLD', 1, NOW);
    await simulateDemoPayment(SELLER, order.reference, 'SUCCESS', NOW);
    expect(db.agentSubscriptions).toHaveLength(1);
    expect(db.subscriptions).toHaveLength(0);
    expect((await getSellerEffectivePlan(SELLER, NOW)).plan.code).toBe('SELLER_FREE');

    // The Marketplace checkout refuses to show or pay an agent order.
    const read = await request(app).get(`/api/v1/marketplace/me/payments/orders/${order.reference}`).set('Authorization', bearer(SELLER));
    expect(read.status).toBe(404);
  });

  it('keeps seller and agent plans apart', async () => {
    await expect(createSellerSubscriptionOrder(SELLER, 'GOLD', NOW)).rejects.toMatchObject({ code: 'PLAN_INVALID' });
    await expect(createSellerSubscriptionOrder(SELLER, 'SELLER_FREE', NOW)).rejects.toMatchObject({ code: 'PLAN_INVALID' });
  });

  it('refuses paid activation in production, where no real provider is configured', async () => {
    settings.nodeEnv = 'production';
    await expect(createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW)).rejects.toMatchObject({ code: 'PAYMENTS_UNAVAILABLE' });
    settings.nodeEnv = 'test';
    const order = await createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW);
    settings.nodeEnv = 'production';
    await expect(simulateDemoPayment(SELLER, order.reference, 'SUCCESS', NOW)).rejects.toMatchObject({ statusCode: 404 });
    // A notification with the wrong amount never activates anything.
    await expect(
      processPaymentEvent({ provider: 'demo', eventId: 'x-1', reference: order.reference, outcome: 'SUCCESS', amountMmk: 1, currency: 'MMK' }, NOW)
    ).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    expect(db.subscriptions).toHaveLength(0);
  });

  it('serves the persisted plan over the API and ignores a plan or price sent by the client', async () => {
    const before = await request(app).get('/api/v1/marketplace/me/subscription').set('Authorization', bearer(SELLER));
    expect(before.status).toBe(200);
    expect(before.body.data).toMatchObject({ status: 'FREE', plan: { code: 'SELLER_FREE' } });

    const created = await request(app)
      .post('/api/v1/marketplace/me/subscription/orders')
      .set('Authorization', bearer(SELLER))
      .send({ planCode: 'seller_premium', amountMmk: 1, userId: OTHER, status: 'PAID' });
    expect(created.status).toBe(201);
    expect(created.body.data.order).toMatchObject({ amountMmk: 90000, status: 'PENDING' });
    expect(db.orders[0].userId).toBe(SELLER);

    const paid = await request(app)
      .post(`/api/v1/marketplace/me/payments/orders/${created.body.data.order.reference}/demo`)
      .set('Authorization', bearer(SELLER))
      .send({ outcome: 'success' });
    expect(paid.status).toBe(200);

    const after = await request(app).get('/api/v1/marketplace/me/subscription').set('Authorization', bearer(SELLER));
    expect(after.body.data).toMatchObject({ status: 'ACTIVE', plan: { code: 'SELLER_PREMIUM', monthlyPriceMmk: 90000 } });

    const plans = await request(app).get('/api/v1/marketplace/seller-plans');
    expect(plans.body.data.plans.map((plan: any) => [plan.code, plan.monthlyPriceMmk, plan.activeListingLimit, plan.freeBoostDays])).toEqual([
      ['SELLER_FREE', 0, 5, 0],
      ['SELLER_PREMIUM', 90000, null, 3]
    ]);
  });

  it('does not let another user pay or read a seller order', async () => {
    const order = await createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW);
    const response = await request(app)
      .post(`/api/v1/marketplace/me/payments/orders/${order.reference}/demo`)
      .set('Authorization', bearer(OTHER))
      .send({ outcome: 'success' });
    expect(response.status).toBe(404);
    expect(db.subscriptions).toHaveLength(0);
  });
});

describe('Marketplace demo purchase on the deployed (production) site', () => {
  const asProduction = (marketplaceDemo: boolean) => {
    settings.nodeEnv = 'production';
    settings.demoPaymentsEnabled = false;
    settings.marketplaceDemoPurchaseEnabled = marketplaceDemo;
  };

  it('activates Premium Seller through the labelled demo checkout when MARKETPLACE_DEMO_PURCHASE_ENABLED is on', async () => {
    asProduction(true);
    const plans = await request(app).get('/api/v1/marketplace/seller-plans');
    expect(plans.body.data.demoPayments).toBe(true);

    const created = await request(app).post('/api/v1/marketplace/me/subscription/orders').set('Authorization', bearer(SELLER)).send({ planCode: 'SELLER_PREMIUM' });
    expect(created.status).toBe(201);
    expect(created.body.data.order).toMatchObject({ isDemo: true, provider: 'demo', amountMmk: 90000, status: 'PENDING' });

    const paid = await request(app)
      .post(`/api/v1/marketplace/me/payments/orders/${created.body.data.order.reference}/demo`)
      .set('Authorization', bearer(SELLER))
      .send({ outcome: 'success' });
    expect(paid.status).toBe(200);

    // Persisted: a fresh request (refresh / new sign-in) reads the same active plan from the database.
    const state = await request(app).get('/api/v1/marketplace/me/subscription').set('Authorization', bearer(SELLER));
    expect(state.body.data).toMatchObject({ status: 'ACTIVE', plan: { code: 'SELLER_PREMIUM' }, allowance: { limit: null } });
    expect(db.orders[0]).toMatchObject({ isDemo: true, status: 'PAID' });

    // Premium features: unlimited products, badge, and the free 3-day boost.
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) addListing(id);
    expect((await getListingAllowance(SELLER)).remaining).toBeNull();
    expect((await claimFreeListingBoost(SELLER, 'a')).days).toBe(3);
  });

  it('keeps agent payments blocked in production even when the Marketplace demo is on', async () => {
    asProduction(true);
    await expect(createSubscriptionOrder(SELLER, 'GOLD', 1, NOW)).rejects.toMatchObject({ code: 'PAYMENTS_UNAVAILABLE' });

    // An agent order created earlier cannot be paid through the demo checkout on the live site.
    settings.nodeEnv = 'test';
    settings.demoPaymentsEnabled = true;
    const agentOrder = await createSubscriptionOrder(SELLER, 'GOLD', 1, NOW);
    asProduction(true);
    await expect(simulateDemoPayment(SELLER, agentOrder.reference, 'SUCCESS', NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.agentSubscriptions).toHaveLength(0);
  });

  it('refuses the demo purchase and explains the missing setting when the Marketplace demo is off', async () => {
    asProduction(false);
    const plans = await request(app).get('/api/v1/marketplace/seller-plans');
    expect(plans.body.data.demoPayments).toBe(false);
    const created = await request(app).post('/api/v1/marketplace/me/subscription/orders').set('Authorization', bearer(SELLER)).send({ planCode: 'SELLER_PREMIUM' });
    expect(created.status).toBe(503);
    expect(created.body.errors.code).toBe('PAYMENTS_UNAVAILABLE');
    expect(created.body.message).toContain('MARKETPLACE_DEMO_PURCHASE_ENABLED');
    expect(db.orders).toHaveLength(0);
    expect(db.subscriptions).toHaveLength(0);
  });

  it('never activates anything without a successful payment event', async () => {
    asProduction(true);
    const order = await createSellerSubscriptionOrder(SELLER, 'SELLER_PREMIUM', NOW);
    await simulateDemoPayment(SELLER, order.reference, 'FAILED', NOW);
    expect(db.subscriptions).toHaveLength(0);
    expect((await getSellerEffectivePlan(SELLER, NOW)).plan.code).toBe('SELLER_FREE');
  });
});

describe('product boosts', () => {
  it('lets only the owner boost a live product, and sells a paid demo boost at the configured price', async () => {
    addListing('mine');
    addListing('theirs', OTHER);
    addListing('sold', SELLER, { status: 'SOLD' });

    await expect(createListingBoostOrder(SELLER, 'theirs', 3, NOW)).rejects.toMatchObject({ code: 'LISTING_FORBIDDEN' });
    await expect(createListingBoostOrder(SELLER, 'sold', 3, NOW)).rejects.toMatchObject({ code: 'LISTING_NOT_BOOSTABLE' });
    await expect(createListingBoostOrder(SELLER, 'mine', 5, NOW)).rejects.toMatchObject({ code: 'BOOST_DAYS_INVALID' });

    const order = await createListingBoostOrder(SELLER, 'mine', 7, NOW);
    expect(order).toMatchObject({ kind: 'LISTING_BOOST', amountMmk: 14000, listingId: 'mine' });
    expect(db.boosts).toHaveLength(0);

    await simulateDemoPayment(SELLER, order.reference, 'SUCCESS', NOW);
    await simulateDemoPayment(SELLER, order.reference, 'SUCCESS', NOW);
    expect(db.boosts).toHaveLength(1);
    expect(db.boosts[0]).toMatchObject({ listingId: 'mine', source: 'PURCHASED', days: 7 });
    expect(db.boosts[0].endsAt.toISOString()).toBe('2026-10-23T05:00:00.000Z');
  });

  it('refuses another seller boosting my product over the API', async () => {
    addListing('mine');
    const response = await request(app).post('/api/v1/marketplace/me/boosts/orders').set('Authorization', bearer(OTHER)).send({ listingId: 'mine', days: 3 });
    expect(response.status).toBe(403);
    expect(db.orders).toHaveLength(0);
  });

  it('gives Premium sellers one free three-day boost per period, and none to Free sellers', async () => {
    addListing('a');
    addListing('b');
    await expect(claimFreeListingBoost(SELLER, 'a', NOW)).rejects.toMatchObject({ code: 'PLAN_FEATURE_LOCKED' });

    await buyPremium();
    const boost = await claimFreeListingBoost(SELLER, 'a', NOW);
    expect(boost).toMatchObject({ source: 'FREE_ENTITLEMENT', days: 3 });
    expect(boost.endsAt.toISOString()).toBe('2026-10-19T05:00:00.000Z');
    await expect(claimFreeListingBoost(SELLER, 'b', NOW)).rejects.toMatchObject({ code: 'FREE_BOOST_ALREADY_CLAIMED' });
    // Boosting never uses an active-product slot.
    expect((await getListingAllowance(SELLER, NOW)).used).toBe(2);
  });

  it('stops promoting a product once its boost ends', async () => {
    addListing('a');
    addListing('b');
    db.boosts.push({ id: 'b1', listingId: 'a', userId: SELLER, source: 'PURCHASED', days: 3, startsAt: new Date(NOW.getTime() - DAY), endsAt: new Date(NOW.getTime() + DAY), cancelledAt: null });
    expect(await pickBoostedListingIds({}, NOW)).toEqual(['a']);
    expect(await pickBoostedListingIds({}, new Date(NOW.getTime() + 2 * DAY))).toEqual([]);
    db.listings[0].status = 'SOLD';
    expect(await pickBoostedListingIds({}, NOW)).toEqual([]);
  });
});

describe('views, inquiries and insights', () => {
  const view = (listingId: string, ip: string, at = NOW, viewerUserId?: string, userAgent = 'Mozilla/5.0') =>
    recordListingView({ listingId, ip, userAgent, viewerUserId }, at);

  it('counts one view per visitor per day and ignores the owner and bots', async () => {
    addListing('a');
    db.users[0].accountStatus = 'ACTIVE';
    expect(await view('a', '1.1.1.1')).toEqual({ recorded: true });
    expect(await view('a', '1.1.1.1')).toEqual({ recorded: false });
    expect(await view('a', '2.2.2.2')).toEqual({ recorded: true });
    expect(await view('a', '3.3.3.3', NOW, SELLER)).toEqual({ recorded: false });
    expect(await view('a', '4.4.4.4', NOW, undefined, 'Googlebot/2.1')).toEqual({ recorded: false });
    expect(db.events.every((event) => event.listingId === 'a' && event.sellerId === SELLER)).toBe(true);
    expect(db.events).toHaveLength(2);
  });

  it('attaches inquiries to the right product and lets only its seller reply', async () => {
    addListing('a');
    const sent = await request(app).post('/api/v1/marketplace/listings/a/inquiries').set('Authorization', bearer(BUYER)).send({ message: 'Is it still available?' });
    expect(sent.status).toBe(201);
    expect(db.inquiries[0]).toMatchObject({ listingId: 'a', sellerId: SELLER, buyerId: BUYER, status: 'NEW' });

    const own = await request(app).post('/api/v1/marketplace/listings/a/inquiries').set('Authorization', bearer(SELLER)).send({ message: 'Hello there' });
    expect(own.status).toBe(400);

    const foreign = await request(app).patch(`/api/v1/marketplace/me/inquiries/${db.inquiries[0].id}`).set('Authorization', bearer(OTHER)).send({ reply: 'Hi' });
    expect(foreign.status).toBe(403);

    const reply = await request(app).patch(`/api/v1/marketplace/me/inquiries/${db.inquiries[0].id}`).set('Authorization', bearer(SELLER)).send({ reply: 'Yes, it is.' });
    expect(reply.status).toBe(200);
    expect(db.inquiries[0]).toMatchObject({ status: 'REPLIED', sellerReply: 'Yes, it is.' });
    expect(db.notifications.some((item) => item.userId === BUYER)).toBe(true);
  });

  it('reports persisted numbers only, with days before tracking began marked as no data', async () => {
    addListing('a');
    addListing('b');
    await view('a', '1.1.1.1', new Date(NOW.getTime() - DAY));
    await view('a', '2.2.2.2');
    await view('b', '3.3.3.3');
    db.inquiries.push({ id: 'i1', listingId: 'a', sellerId: SELLER, buyerId: BUYER, status: 'NEW', createdAt: NOW });

    const basic = await getSellerInsights(SELLER, 30, NOW);
    expect(basic).toMatchObject({ level: 'BASIC', days: 7, totals: { views: 3, inquiries: 1 }, series: null, bestPerforming: null });

    await buyPremium();
    const detailed = await getSellerInsights(SELLER, 30, NOW);
    expect(detailed.level).toBe('DETAILED');
    expect(detailed.days).toBe(30);
    expect(detailed.trackingSince).toBe('2026-10-15');
    const series = detailed.series ?? [];
    expect(series.at(-1)).toEqual({ day: '2026-10-16', views: 2, inquiries: 1 });
    expect(series.at(-2)).toEqual({ day: '2026-10-15', views: 1, inquiries: 0 });
    expect(series.at(-3)).toEqual({ day: '2026-10-14', views: null, inquiries: null });
    expect(detailed.bestPerforming?.[0]).toMatchObject({ listing: { id: 'a' }, views: 2, inquiries: 1 });
  });
});
