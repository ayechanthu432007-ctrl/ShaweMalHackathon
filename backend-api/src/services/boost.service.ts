import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { LOCKED_TRANSACTION_OPTIONS, lockForTransaction } from '../utils/advisory-lock';
import { ApiError } from '../utils/api-error';
import { writeAuditLog } from './audit.service';
import { getEffectivePlan } from './subscription.service';

type Db = Prisma.TransactionClient | typeof prisma;

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_BOOST_DAYS_PER_ORDER = 30;
/** How many boosted listings may lead the first page of search results. */
export const BOOSTED_SLOTS_PER_PAGE = 3;
export const BOOST_PRICE_SETTING = 'BOOST_PRICE_PER_DAY_MMK';

/** A boost counts only while it is running, not cancelled, and its listing is still available. */
export const activeBoostWhere = (now: Date): Prisma.HouseBoostWhereInput => ({
  cancelledAt: null,
  startsAt: { lte: now },
  endsAt: { gt: now },
  house: { availability: 'AVAILABLE' }
});

export const getBoostPricePerDay = async (db: Db = prisma): Promise<number> => {
  const setting = await db.appSetting.findUnique({ where: { key: BOOST_PRICE_SETTING } });
  const price = Number(setting?.value);
  if (!Number.isInteger(price) || price <= 0) {
    throw new ApiError(500, 'BOOST_PRICE_MISSING', 'Boost pricing is not set up.');
  }
  return price;
};

/** Only the owner's own, currently available listings can be boosted. */
export const assertBoostableHouse = async (userId: string, houseId: string, db: Db = prisma) => {
  const house = await db.house.findUnique({ where: { id: houseId }, select: { id: true, agentId: true, title: true, availability: true } });
  if (!house) {
    throw new ApiError(404, 'HOUSE_NOT_FOUND', 'House not found.');
  }
  if (house.agentId !== userId) {
    throw new ApiError(403, 'HOUSE_FORBIDDEN', 'You can only boost your own listings.');
  }
  if (house.availability !== 'AVAILABLE') {
    throw new ApiError(409, 'HOUSE_NOT_BOOSTABLE', 'Only available listings can be boosted.');
  }
  return house;
};

/** A new boost starts when the listing's current boost ends, so periods never overlap. */
export const nextBoostStart = async (houseId: string, now: Date, db: Db = prisma): Promise<Date> => {
  const latest = await db.houseBoost.findFirst({
    where: { houseId, cancelledAt: null, endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
    select: { endsAt: true }
  });
  return latest ? latest.endsAt : now;
};

export const boostEnd = (startsAt: Date, days: number): Date => new Date(startsAt.getTime() + days * DAY_MS);

export interface FreeBoostBalance {
  granted: number;
  used: number;
  remaining: number;
  /** Free days belong to the paid period they came with and expire with it. */
  expiresAt: Date | null;
  subscriptionId: string | null;
}

export const getFreeBoostBalance = async (userId: string, now = new Date(), db: Db = prisma): Promise<FreeBoostBalance> => {
  const { subscription } = await getEffectivePlan(userId, now, db);
  if (!subscription || subscription.plan.freeBoostDays === 0) {
    return { granted: 0, used: 0, remaining: 0, expiresAt: null, subscriptionId: null };
  }

  const usage = await db.houseBoost.aggregate({
    where: { subscriptionId: subscription.id, source: 'FREE_ENTITLEMENT' },
    _sum: { days: true }
  });
  const used = usage._sum.days ?? 0;
  const granted = subscription.plan.freeBoostDays;
  return { granted, used, remaining: Math.max(0, granted - used), expiresAt: subscription.endsAt, subscriptionId: subscription.id };
};

/**
 * Spends free Auto-Boost days on one listing chosen by the agent. Documented rules:
 * days are granted once per purchased period, the agent decides where to spend them,
 * and only one listing at a time may run on free days.
 */
export const applyFreeBoost = async (userId: string, houseId: string, days: number, now = new Date()) => {
  return prisma.$transaction(async (tx) => {
    // Two simultaneous requests must not both spend the same remaining days.
    await lockForTransaction(tx, `free-boost:${userId}`);
    const house = await assertBoostableHouse(userId, houseId, tx);
    const balance = await getFreeBoostBalance(userId, now, tx);
    if (!balance.subscriptionId || balance.granted === 0) {
      throw new ApiError(403, 'PLAN_FEATURE_LOCKED', 'Your current plan does not include free Auto-Boost days.');
    }
    if (days > balance.remaining) {
      throw new ApiError(409, 'FREE_BOOST_INSUFFICIENT', `You have ${balance.remaining} free boost day(s) left.`);
    }

    const running = await tx.houseBoost.findFirst({
      where: { userId, source: 'FREE_ENTITLEMENT', cancelledAt: null, endsAt: { gt: now }, houseId: { not: houseId } },
      select: { id: true }
    });
    if (running) {
      throw new ApiError(409, 'FREE_BOOST_ALREADY_RUNNING', 'Free boost days can run on one listing at a time.');
    }

    const startsAt = await nextBoostStart(houseId, now, tx);
    const boost = await tx.houseBoost.create({
      data: {
        houseId,
        userId,
        source: 'FREE_ENTITLEMENT',
        days,
        startsAt,
        endsAt: boostEnd(startsAt, days),
        subscriptionId: balance.subscriptionId
      }
    });

    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AGENT_FREE_BOOST_APPLIED',
        targetType: 'House',
        targetId: houseId,
        metadata: { days, boostId: boost.id, title: house.title }
      }
    });

    return boost;
  }, LOCKED_TRANSACTION_OPTIONS);
};

/** Stops running and scheduled boosts when a listing is no longer eligible. Unused time is not returned. */
export const cancelBoostsForHouse = async (houseId: string, reason: string, now = new Date()) => {
  const result = await prisma.houseBoost.updateMany({
    where: { houseId, cancelledAt: null, endsAt: { gt: now } },
    data: { cancelledAt: now }
  });
  if (result.count > 0) {
    await writeAuditLog({ action: 'HOUSE_BOOST_CANCELLED', targetType: 'House', targetId: houseId, metadata: { reason, count: result.count } });
  }
  return result.count;
};

export const listAgentBoosts = async (userId: string, now = new Date()) => {
  const boosts = await prisma.houseBoost.findMany({
    where: { userId },
    include: { house: { select: { id: true, title: true, availability: true } } },
    orderBy: { startsAt: 'desc' },
    take: 50
  });

  return boosts.map((boost) => {
    const status = boost.cancelledAt
      ? 'CANCELLED'
      : boost.endsAt <= now
        ? 'ENDED'
        : boost.startsAt > now
          ? 'SCHEDULED'
          : boost.house.availability === 'AVAILABLE'
            ? 'ACTIVE'
            : 'PAUSED';
    return {
      id: boost.id,
      house: boost.house,
      source: boost.source,
      days: boost.days,
      startsAt: boost.startsAt,
      endsAt: boost.endsAt,
      status,
      hoursRemaining: status === 'ACTIVE' ? Math.max(0, Math.ceil((boost.endsAt.getTime() - now.getTime()) / (60 * 60 * 1000))) : 0
    };
  });
};

/**
 * Boosted listings that match the visitor's own filters, for the top of the first results page.
 * The order rotates daily so the same listing is not always first.
 */
export const pickBoostedHouseIds = async (where: Prisma.HouseWhereInput, now = new Date()): Promise<string[]> => {
  const boosts = await prisma.houseBoost.findMany({
    where: { ...activeBoostWhere(now), house: { AND: [where, { availability: 'AVAILABLE' }] } },
    select: { houseId: true },
    distinct: ['houseId'],
    take: 30
  });

  const ids = boosts.map((boost) => boost.houseId).sort();
  if (ids.length <= BOOSTED_SLOTS_PER_PAGE) {
    return ids;
  }

  const offset = Math.floor(now.getTime() / DAY_MS) % ids.length;
  return [...ids.slice(offset), ...ids.slice(0, offset)].slice(0, BOOSTED_SLOTS_PER_PAGE);
};
