import type { AgentSubscription, Prisma, SubscriptionPlan } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';

export const FREE_PLAN_CODE = 'FREE';
export const LISTING_CREATED_ACTION = 'AGENT_HOUSE_CREATED';

/** Myanmar has a fixed UTC+6:30 offset with no daylight saving. */
const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

export type PlanFeature = 'performanceOverview' | 'performanceDetailed' | 'audienceInsights' | 'monthlyReport';

/** Calendar day (YYYY-MM-DD) and hour (0-23) of a moment in Asia/Yangon. */
export const yangonDayAndHour = (date: Date): { day: string; hour: number } => {
  const shifted = new Date(date.getTime() + YANGON_OFFSET_MS);
  return { day: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
};

/** First instant of the Asia/Yangon calendar month containing `date`, and of the next month. */
export const yangonMonthRange = (date: Date): { start: Date; end: Date; month: string } => {
  const shifted = new Date(date.getTime() + YANGON_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - YANGON_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - YANGON_OFFSET_MS),
    month: `${year}-${String(month + 1).padStart(2, '0')}`
  };
};

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

export const listPlans = (db: Db = prisma) =>
  db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { rank: 'asc' } });

const getFreePlan = async (db: Db): Promise<SubscriptionPlan> => {
  const plan = await db.subscriptionPlan.findUnique({ where: { code: FREE_PLAN_CODE } });
  if (!plan) {
    throw new ApiError(500, 'PLAN_CATALOGUE_MISSING', 'Subscription plans are not set up.');
  }
  return plan;
};

export interface EffectivePlan {
  plan: SubscriptionPlan;
  /** The paid period currently in force, or null on the free plan. */
  subscription: (AgentSubscription & { plan: SubscriptionPlan }) | null;
  /** True when the agent had a paid plan that has now ended. */
  hasExpiredPaidPlan: boolean;
}

/**
 * The plan in force right now: the highest-ranked paid period whose dates contain `now`,
 * otherwise the free plan. Expiry needs no background job; it is just a date comparison.
 */
export const getEffectivePlan = async (userId: string, now = new Date(), db: Db = prisma): Promise<EffectivePlan> => {
  const subscriptions = await db.agentSubscription.findMany({
    where: { userId },
    include: { plan: true },
    orderBy: { endsAt: 'desc' }
  });

  const active = subscriptions
    .filter((item) => item.startsAt <= now && item.endsAt > now)
    .sort((a, b) => b.plan.rank - a.plan.rank || b.endsAt.getTime() - a.endsAt.getTime());

  const current = active[0];
  if (current) {
    return { plan: current.plan, subscription: current, hasExpiredPaidPlan: false };
  }

  return {
    plan: await getFreePlan(db),
    subscription: null,
    hasExpiredPaidPlan: subscriptions.some((item) => item.endsAt <= now)
  };
};

export const planAllows = (plan: SubscriptionPlan, feature: PlanFeature): boolean => {
  switch (feature) {
    case 'performanceOverview':
      return plan.performanceLevel === 'OVERVIEW' || plan.performanceLevel === 'DETAILED';
    case 'performanceDetailed':
      return plan.performanceLevel === 'DETAILED';
    case 'audienceInsights':
      return plan.audienceInsights;
    case 'monthlyReport':
      return plan.monthlyReport;
  }
};

export const assertPlanFeature = async (userId: string, feature: PlanFeature, now = new Date()): Promise<EffectivePlan> => {
  const effective = await getEffectivePlan(userId, now);
  if (!planAllows(effective.plan, feature)) {
    throw new ApiError(403, 'PLAN_FEATURE_LOCKED', 'Your current plan does not include this feature.', {
      feature,
      plan: effective.plan.code
    });
  }
  return effective;
};

export interface ListingUsage {
  month: string;
  used: number;
  /** Null means the plan has no numerical limit. */
  limit: number | null;
  remaining: number | null;
  resetsAt: Date;
}

/**
 * New listings created this Asia/Yangon calendar month. Creations are counted from the audit
 * log, so deleting a listing does not hand the slot back; listings that predate the log are
 * counted from the houses that still exist.
 */
export const getListingUsage = async (userId: string, plan: SubscriptionPlan, now = new Date(), db: Db = prisma): Promise<ListingUsage> => {
  const range = yangonMonthRange(now);
  const createdAt = { gte: range.start, lt: range.end };
  const [logged, existing] = await Promise.all([
    db.auditLog.count({ where: { actorUserId: userId, action: LISTING_CREATED_ACTION, createdAt } }),
    db.house.count({ where: { agentId: userId, createdAt } })
  ]);

  const used = Math.max(logged, existing);
  const limit = plan.monthlyListingLimit;
  return {
    month: range.month,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: range.end
  };
};

export const assertListingAllowance = async (userId: string, now = new Date(), db: Db = prisma): Promise<void> => {
  const { plan } = await getEffectivePlan(userId, now, db);
  const usage = await getListingUsage(userId, plan, now, db);
  if (usage.limit !== null && usage.used >= usage.limit) {
    throw new ApiError(
      403,
      'LISTING_LIMIT_REACHED',
      `Your ${plan.name} plan allows ${usage.limit} new listings per month. Upgrade your plan or wait until next month.`,
      { plan: plan.code, limit: usage.limit, used: usage.used, resetsAt: usage.resetsAt }
    );
  }
};

/**
 * The public Verified Badge needs both: admin approval of the agent's documents AND an
 * active plan that includes the badge. Paying for a plan never verifies anyone.
 */
export const hasVerifiedBadge = (verificationStatus: string | null | undefined, plan: SubscriptionPlan): boolean =>
  verificationStatus === 'VERIFIED' && plan.badgeEligible;

export const serializePlan = (plan: SubscriptionPlan) => ({
  code: plan.code,
  name: plan.name,
  rank: plan.rank,
  monthlyPriceMmk: plan.monthlyPriceMmk,
  quarterlyPriceMmk: plan.quarterlyPriceMmk,
  monthlyListingLimit: plan.monthlyListingLimit,
  freeBoostDays: plan.freeBoostDays,
  badgeEligible: plan.badgeEligible,
  performanceLevel: plan.performanceLevel,
  audienceInsights: plan.audienceInsights,
  monthlyReport: plan.monthlyReport
});
