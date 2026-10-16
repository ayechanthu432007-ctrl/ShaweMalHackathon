import type { Prisma, SellerSubscription, SubscriptionPlan } from '@prisma/client';

import { prisma } from '../prisma/client';
import { LOCKED_TRANSACTION_OPTIONS, lockForTransaction } from '../utils/advisory-lock';
import { ApiError } from '../utils/api-error';

/**
 * Marketplace seller plans. The rules (price, active-product limit, free boost days, badge,
 * insight level, homepage placement) live in the SubscriptionPlan rows with audience SELLER;
 * nothing here or in the frontend repeats the numbers.
 */
export const SELLER_PLAN_AUDIENCE = 'SELLER';
export const SELLER_FREE_PLAN_CODE = 'SELLER_FREE';
export const LISTING_BOOST_PRICE_SETTING = 'LISTING_BOOST_PRICE_PER_DAY_MMK';
/** Paid boost lengths a seller can choose from. */
export const LISTING_BOOST_DAY_OPTIONS = [3, 7, 14] as const;
/** How many boosted products may lead the first page of search results. */
export const BOOSTED_LISTING_SLOTS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

export const listSellerPlans = (db: Db = prisma) =>
  db.subscriptionPlan.findMany({ where: { audience: SELLER_PLAN_AUDIENCE, isActive: true }, orderBy: { rank: 'asc' } });

const getSellerFreePlan = async (db: Db): Promise<SubscriptionPlan> => {
  const plan = await db.subscriptionPlan.findUnique({ where: { code: SELLER_FREE_PLAN_CODE } });
  if (!plan) {
    throw new ApiError(500, 'PLAN_CATALOGUE_MISSING', 'Seller plans are not set up.');
  }
  return plan;
};

export interface SellerEffectivePlan {
  plan: SubscriptionPlan;
  subscription: (SellerSubscription & { plan: SubscriptionPlan }) | null;
  /** A later paid period already bought (renewal), if any. */
  renewal: (SellerSubscription & { plan: SubscriptionPlan }) | null;
  hasExpiredPaidPlan: boolean;
}

/** The seller plan in force: the paid period whose dates contain `now`, else Free Seller. Expiry is a date comparison. */
export const getSellerEffectivePlan = async (userId: string, now = new Date(), db: Db = prisma): Promise<SellerEffectivePlan> => {
  const subscriptions = await db.sellerSubscription.findMany({ where: { userId }, include: { plan: true }, orderBy: { endsAt: 'desc' } });
  const current = subscriptions
    .filter((item) => item.startsAt <= now && item.endsAt > now)
    .sort((a, b) => b.plan.rank - a.plan.rank || b.endsAt.getTime() - a.endsAt.getTime())[0];
  const renewal = subscriptions.filter((item) => item.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null;

  if (current) {
    return { plan: current.plan, subscription: current, renewal, hasExpiredPaidPlan: false };
  }
  return { plan: await getSellerFreePlan(db), subscription: null, renewal, hasExpiredPaidPlan: subscriptions.some((item) => item.endsAt <= now) };
};

/** Sellers whose paid plan currently includes homepage placement and the Premium badge. */
export const getPremiumSellerIds = async (sellerIds: string[], now = new Date(), db: Db = prisma): Promise<Set<string>> => {
  const ids = [...new Set(sellerIds)];
  if (ids.length === 0) return new Set();
  const rows = await db.sellerSubscription.findMany({
    where: { userId: { in: ids }, startsAt: { lte: now }, endsAt: { gt: now }, plan: { badgeEligible: true } },
    select: { userId: true }
  });
  return new Set(rows.map((row) => row.userId));
};

/**
 * Products that use a slot: live (ACTIVE) and not taken down by moderation. Sold products and
 * products rejected or removed by an admin do not count; deleted products no longer exist.
 */
export const countedListingWhere = (userId: string): Prisma.ListingWhereInput => ({
  sellerId: userId,
  status: 'ACTIVE',
  moderationStatus: { in: ['APPROVED', 'PENDING'] }
});

export interface ListingAllowance {
  planCode: string;
  used: number;
  /** Null means the plan has no limit. */
  limit: number | null;
  remaining: number | null;
}

export const getListingAllowance = async (userId: string, now = new Date(), db: Db = prisma): Promise<ListingAllowance> => {
  const [{ plan }, used] = await Promise.all([getSellerEffectivePlan(userId, now, db), db.listing.count({ where: countedListingWhere(userId) })]);
  const limit = plan.activeListingLimit;
  return { planCode: plan.code, used, limit, remaining: limit === null ? null : Math.max(0, limit - used) };
};

/** Server-side limit check; callers run it inside a transaction locked per seller. */
export const assertListingSlotAvailable = async (userId: string, now = new Date(), db: Db = prisma): Promise<void> => {
  const allowance = await getListingAllowance(userId, now, db);
  if (allowance.limit !== null && allowance.used >= allowance.limit) {
    throw new ApiError(
      403,
      'LISTING_LIMIT_REACHED',
      `The Free Seller plan allows ${allowance.limit} active products. Mark one as sold, delete one, or upgrade to Premium Seller for unlimited products.`,
      { plan: allowance.planCode, limit: allowance.limit, used: allowance.used }
    );
  }
};

/** Runs `work` while holding the seller's listing-slot lock so two requests cannot both take the last slot. */
export const withListingSlot = <T>(userId: string, work: (tx: Prisma.TransactionClient) => Promise<T>, now = new Date()) =>
  prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, `listing-slot:${userId}`);
    await assertListingSlotAvailable(userId, now, tx);
    return work(tx);
  }, LOCKED_TRANSACTION_OPTIONS);

export const serializeSellerPlan = (plan: SubscriptionPlan) => ({
  code: plan.code,
  name: plan.name,
  rank: plan.rank,
  monthlyPriceMmk: plan.monthlyPriceMmk,
  activeListingLimit: plan.activeListingLimit,
  freeBoostDays: plan.freeBoostDays,
  premiumBadge: plan.badgeEligible,
  homepageFeatured: plan.homepageFeatured,
  insightsLevel: plan.performanceLevel === 'DETAILED' ? ('DETAILED' as const) : ('BASIC' as const)
});

// --- Product boosts ---

/** A boost promotes a product only while it is running, not cancelled, and the product is live. */
export const activeListingBoostWhere = (now: Date): Prisma.ListingBoostWhereInput => ({
  cancelledAt: null,
  startsAt: { lte: now },
  endsAt: { gt: now },
  listing: { status: 'ACTIVE', moderationStatus: 'APPROVED' }
});

export const getListingBoostPricePerDay = async (db: Db = prisma): Promise<number> => {
  const setting = await db.appSetting.findUnique({ where: { key: LISTING_BOOST_PRICE_SETTING } });
  const price = Number(setting?.value);
  if (!Number.isInteger(price) || price <= 0) {
    throw new ApiError(500, 'BOOST_PRICE_MISSING', 'Product boost pricing is not set up.');
  }
  return price;
};

/** Only the owner's own live, approved products can be boosted. */
export const assertBoostableListing = async (userId: string, listingId: string, db: Db = prisma) => {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, title: true, status: true, moderationStatus: true }
  });
  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }
  if (listing.sellerId !== userId) {
    throw new ApiError(403, 'LISTING_FORBIDDEN', 'You can only boost your own products.');
  }
  if (listing.status !== 'ACTIVE' || listing.moderationStatus !== 'APPROVED') {
    throw new ApiError(409, 'LISTING_NOT_BOOSTABLE', 'Only live, approved products can be boosted.');
  }
  return listing;
};

/** A new boost starts when the product's current boost ends, so periods never overlap. */
export const nextListingBoostStart = async (listingId: string, now: Date, db: Db = prisma): Promise<Date> => {
  const latest = await db.listingBoost.findFirst({
    where: { listingId, cancelledAt: null, endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
    select: { endsAt: true }
  });
  return latest ? latest.endsAt : now;
};

export const listingBoostEnd = (startsAt: Date, days: number): Date => new Date(startsAt.getTime() + days * DAY_MS);

export interface SellerFreeBoost {
  /** Days included with the current paid period (0 on Free Seller). */
  days: number;
  claimed: boolean;
  available: boolean;
  /** The benefit belongs to the paid period and lapses with it. */
  expiresAt: Date | null;
  subscriptionId: string | null;
}

/** Premium's free boost: one claim of the plan's free days per paid period. */
export const getSellerFreeBoost = async (userId: string, now = new Date(), db: Db = prisma): Promise<SellerFreeBoost> => {
  const { subscription } = await getSellerEffectivePlan(userId, now, db);
  if (!subscription || subscription.plan.freeBoostDays <= 0) {
    return { days: 0, claimed: false, available: false, expiresAt: null, subscriptionId: null };
  }
  const claimed = (await db.listingBoost.count({ where: { subscriptionId: subscription.id, source: 'FREE_ENTITLEMENT' } })) > 0;
  return { days: subscription.plan.freeBoostDays, claimed, available: !claimed, expiresAt: subscription.endsAt, subscriptionId: subscription.id };
};

export const claimFreeListingBoost = async (userId: string, listingId: string, now = new Date()) =>
  prisma.$transaction(async (tx) => {
    // Repeated or simultaneous requests are serialised, so the benefit is spent once.
    await lockForTransaction(tx, `listing-free-boost:${userId}`);
    const listing = await assertBoostableListing(userId, listingId, tx);
    const free = await getSellerFreeBoost(userId, now, tx);
    if (!free.subscriptionId || free.days === 0) {
      throw new ApiError(403, 'PLAN_FEATURE_LOCKED', 'The free product boost is a Premium Seller benefit.');
    }
    if (free.claimed) {
      throw new ApiError(409, 'FREE_BOOST_ALREADY_CLAIMED', 'You have already used the free boost for this subscription period.');
    }

    const startsAt = await nextListingBoostStart(listingId, now, tx);
    const boost = await tx.listingBoost.create({
      data: { listingId, userId, source: 'FREE_ENTITLEMENT', days: free.days, startsAt, endsAt: listingBoostEnd(startsAt, free.days), subscriptionId: free.subscriptionId }
    });
    await tx.auditLog.create({
      data: { actorUserId: userId, action: 'LISTING_FREE_BOOST_CLAIMED', targetType: 'Listing', targetId: listingId, metadata: { days: free.days, boostId: boost.id, title: listing.title } }
    });
    return boost;
  }, LOCKED_TRANSACTION_OPTIONS);

export type ListingBoostStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'CANCELLED' | 'PAUSED';

export const boostStatus = (
  boost: { startsAt: Date; endsAt: Date; cancelledAt: Date | null },
  listing: { status: string; moderationStatus: string },
  now: Date
): ListingBoostStatus => {
  if (boost.cancelledAt) return 'CANCELLED';
  if (boost.endsAt <= now) return 'ENDED';
  if (boost.startsAt > now) return 'SCHEDULED';
  return listing.status === 'ACTIVE' && listing.moderationStatus === 'APPROVED' ? 'ACTIVE' : 'PAUSED';
};

/** The current (or next scheduled) boost per product, for product lists. */
export const getCurrentBoosts = async (listingIds: string[], now = new Date(), db: Db = prisma) => {
  const boosts = await db.listingBoost.findMany({
    where: { listingId: { in: listingIds }, cancelledAt: null, endsAt: { gt: now } },
    orderBy: { startsAt: 'asc' },
    select: { listingId: true, source: true, startsAt: true, endsAt: true }
  });
  const result = new Map<string, { source: string; startsAt: Date; endsAt: Date }>();
  for (const boost of boosts) {
    const existing = result.get(boost.listingId);
    // Back-to-back periods merge into one visible window.
    if (existing && existing.endsAt.getTime() === boost.startsAt.getTime()) {
      existing.endsAt = boost.endsAt;
    } else if (!existing) {
      result.set(boost.listingId, { ...boost });
    }
  }
  return result;
};

export const listSellerBoosts = async (userId: string, now = new Date()) => {
  const boosts = await prisma.listingBoost.findMany({
    where: { userId },
    include: { listing: { select: { id: true, title: true, status: true, moderationStatus: true } } },
    orderBy: { startsAt: 'desc' },
    take: 50
  });
  return boosts.map((boost) => ({
    id: boost.id,
    listing: { id: boost.listing.id, title: boost.listing.title },
    source: boost.source,
    days: boost.days,
    startsAt: boost.startsAt,
    endsAt: boost.endsAt,
    status: boostStatus(boost, boost.listing, now)
  }));
};

/** Stops running and scheduled boosts when a product is sold or deleted. */
export const cancelListingBoosts = async (listingId: string, now = new Date(), db: Db = prisma) =>
  (await db.listingBoost.updateMany({ where: { listingId, cancelledAt: null, endsAt: { gt: now } }, data: { cancelledAt: now } })).count;

/**
 * Boosted products matching the visitor's filters, for the top of the first results page.
 * Expired boosts drop out by date alone; the order rotates daily so no product is always first.
 */
export const pickBoostedListingIds = async (where: Prisma.ListingWhereInput, now = new Date()): Promise<string[]> => {
  const boosts = await prisma.listingBoost.findMany({
    where: { ...activeListingBoostWhere(now), listing: { AND: [where, { status: 'ACTIVE', moderationStatus: 'APPROVED' }] } },
    select: { listingId: true },
    distinct: ['listingId'],
    take: 30
  });
  const ids = boosts.map((boost) => boost.listingId).sort();
  if (ids.length <= BOOSTED_LISTING_SLOTS) return ids;
  const offset = Math.floor(now.getTime() / DAY_MS) % ids.length;
  return [...ids.slice(offset), ...ids.slice(0, offset)].slice(0, BOOSTED_LISTING_SLOTS);
};
