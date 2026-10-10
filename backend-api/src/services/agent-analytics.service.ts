import { createHash } from 'node:crypto';

import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { activeBoostWhere, getBoostPricePerDay, getFreeBoostBalance } from './boost.service';
import { demoPaymentProvider } from './payment.service';
import {
  assertPlanFeature,
  getEffectivePlan,
  getListingUsage,
  hasVerifiedBadge,
  listPlans,
  planAllows,
  serializePlan,
  yangonDayAndHour,
  yangonMonthRange
} from './subscription.service';

/**
 * Metric definitions (shown to agents in the dashboard):
 * - View: a listing's detail page opened by a visitor. Counted once per visitor, per listing,
 *   per day; refreshes do not add views. The owner's own visits are not counted.
 * - Call / Telegram / Viber: a tap on that contact button, counted the same way.
 * - Inquiry: a booking made on the listing, plus contact taps (call, Telegram, Viber).
 */
export const HOUSE_EVENT_TYPES = ['VIEW', 'CALL', 'TELEGRAM', 'VIBER'] as const;
export type HouseEventType = (typeof HOUSE_EVENT_TYPES)[number];
const CONTACT_TYPES: HouseEventType[] = ['CALL', 'TELEGRAM', 'VIBER'];

const DAY_MS = 24 * 60 * 60 * 1000;
const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;

/** Daily-rotating salted hash: enough to de-duplicate, useless for identifying anyone. */
const visitorKeyFor = (day: string, ip: string, userAgent: string): string =>
  createHash('sha256').update(`${env.jwtSecret}|${day}|${ip}|${userAgent}`).digest('hex').slice(0, 32);

export const recordHouseEvent = async (input: { houseId: string; type: HouseEventType; ip: string; userAgent: string; viewerUserId?: string }, now = new Date()) => {
  const house = await prisma.house.findUnique({ where: { id: input.houseId }, select: { id: true, agentId: true } });
  if (!house) {
    throw new ApiError(404, 'HOUSE_NOT_FOUND', 'House not found.');
  }

  if (input.viewerUserId === house.agentId) {
    return { recorded: false };
  }

  const { day, hour } = yangonDayAndHour(now);
  const result = await prisma.houseEvent.createMany({
    data: [
      {
        houseId: house.id,
        agentId: house.agentId,
        type: input.type,
        visitorKey: visitorKeyFor(day, input.ip, input.userAgent),
        day,
        hour,
        signedIn: Boolean(input.viewerUserId)
      }
    ],
    skipDuplicates: true
  });

  return { recorded: result.count > 0 };
};

const dayString = (date: Date) => yangonDayAndHour(date).day;

const lastDays = (days: number, now: Date): string[] =>
  Array.from({ length: days }, (_, index) => dayString(new Date(now.getTime() - (days - 1 - index) * DAY_MS)));

interface Totals {
  views: number;
  calls: number;
  telegram: number;
  viber: number;
  bookings: number;
  inquiries: number;
}

const emptyTotals = (): Totals => ({ views: 0, calls: 0, telegram: 0, viber: 0, bookings: 0, inquiries: 0 });

const addEvent = (totals: Totals, type: string, count: number) => {
  if (type === 'VIEW') totals.views += count;
  if (type === 'CALL') totals.calls += count;
  if (type === 'TELEGRAM') totals.telegram += count;
  if (type === 'VIBER') totals.viber += count;
  if (CONTACT_TYPES.includes(type as HouseEventType)) totals.inquiries += count;
};

/** Bookings on the agent's listings between two instants, as the Yangon day each was made. */
const bookingDays = async (agentId: string, from: Date, to: Date) => {
  const bookings = await prisma.booking.findMany({
    where: { house: { agentId }, createdAt: { gte: from, lt: to } },
    select: { houseId: true, createdAt: true }
  });
  return bookings.map((booking) => ({ houseId: booking.houseId, day: dayString(booking.createdAt) }));
};

const dayStart = (day: string): Date => new Date(Date.parse(`${day}T00:00:00.000Z`) - YANGON_OFFSET_MS);

const collect = async (agentId: string, fromDay: string, toDay: string) => {
  const [events, bookings] = await Promise.all([
    prisma.houseEvent.groupBy({
      by: ['day', 'type', 'houseId'],
      where: { agentId, day: { gte: fromDay, lte: toDay } },
      _count: { _all: true }
    }),
    bookingDays(agentId, dayStart(fromDay), new Date(dayStart(toDay).getTime() + DAY_MS))
  ]);

  const totals = emptyTotals();
  const byDay = new Map<string, Totals>();
  const byHouse = new Map<string, Totals>();
  const bucket = (map: Map<string, Totals>, key: string) => {
    if (!map.has(key)) map.set(key, emptyTotals());
    return map.get(key) as Totals;
  };

  for (const row of events) {
    const count = row._count._all;
    addEvent(totals, row.type, count);
    addEvent(bucket(byDay, row.day), row.type, count);
    addEvent(bucket(byHouse, row.houseId), row.type, count);
  }

  for (const booking of bookings) {
    for (const target of [totals, bucket(byDay, booking.day), bucket(byHouse, booking.houseId)]) {
      target.bookings += 1;
      target.inquiries += 1;
    }
  }

  return { totals, byDay, byHouse };
};

const houseBreakdown = async (agentId: string, byHouse: Map<string, Totals>) => {
  const houses = await prisma.house.findMany({ where: { agentId }, select: { id: true, title: true, availability: true }, orderBy: { createdAt: 'desc' } });
  return houses
    .map((house) => ({ house, ...(byHouse.get(house.id) ?? emptyTotals()) }))
    .sort((a, b) => b.views - a.views || b.inquiries - a.inquiries);
};

export const getAgentDashboard = async (userId: string, now = new Date()) => {
  const [effective, profile, plans] = await Promise.all([
    getEffectivePlan(userId, now),
    prisma.agentProfile.findUnique({ where: { userId }, select: { verificationStatus: true, rejectionReason: true, reviewedAt: true } }),
    listPlans()
  ]);

  const days = lastDays(30, now);
  const [usage, freeBoost, stats, listingCount, activeBoosts, boostPricePerDay] = await Promise.all([
    getListingUsage(userId, effective.plan, now),
    getFreeBoostBalance(userId, now),
    collect(userId, days[0] as string, days[days.length - 1] as string),
    prisma.house.count({ where: { agentId: userId } }),
    prisma.houseBoost.count({ where: { userId, ...activeBoostWhere(now) } }),
    getBoostPricePerDay()
  ]);

  const verificationStatus = profile?.verificationStatus ?? null;
  const plan = effective.plan;

  return {
    plan: serializePlan(plan),
    subscription: effective.subscription
      ? {
          status: 'ACTIVE' as const,
          billingMonths: effective.subscription.billingMonths,
          startsAt: effective.subscription.startsAt,
          endsAt: effective.subscription.endsAt,
          daysRemaining: Math.max(0, Math.ceil((effective.subscription.endsAt.getTime() - now.getTime()) / DAY_MS))
        }
      : { status: effective.hasExpiredPaidPlan ? ('EXPIRED' as const) : ('FREE' as const), billingMonths: null, startsAt: null, endsAt: null, daysRemaining: null },
    plans: plans.map(serializePlan),
    listingUsage: usage,
    listingCount,
    freeBoost,
    activeBoosts,
    boostPricePerDay,
    verification: {
      // NOT_SUBMITTED | PENDING | VERIFIED | REJECTED. Only an admin can change it.
      status: verificationStatus ?? 'NOT_SUBMITTED',
      rejectionReason: profile?.rejectionReason ?? null,
      reviewedAt: profile?.reviewedAt ?? null,
      badgeEligiblePlan: plan.badgeEligible,
      badgeShown: hasVerifiedBadge(verificationStatus, plan)
    },
    features: {
      performanceOverview: planAllows(plan, 'performanceOverview'),
      performanceDetailed: planAllows(plan, 'performanceDetailed'),
      audienceInsights: planAllows(plan, 'audienceInsights'),
      monthlyReport: planAllows(plan, 'monthlyReport')
    },
    last30Days: stats.totals,
    demoPayments: demoPaymentProvider.isAvailable()
  };
};

/**
 * Free: totals for the last 30 days. Silver: adds the day-by-day series.
 * Gold: adds a per-listing breakdown and a choice of 7, 30 or 90 days.
 */
export const getAgentPerformance = async (userId: string, requestedDays: number, now = new Date()) => {
  const { plan } = await getEffectivePlan(userId, now);
  const detailed = planAllows(plan, 'performanceDetailed');
  const overview = planAllows(plan, 'performanceOverview');
  const rangeDays = detailed && [7, 30, 90].includes(requestedDays) ? requestedDays : 30;

  const days = lastDays(rangeDays, now);
  const stats = await collect(userId, days[0] as string, days[days.length - 1] as string);

  return {
    level: plan.performanceLevel,
    rangeDays,
    totals: stats.totals,
    series: overview ? days.map((day) => ({ day, ...(stats.byDay.get(day) ?? emptyTotals()) })) : null,
    listings: detailed ? await houseBreakdown(userId, stats.byHouse) : null
  };
};

/** Gold only. Every figure comes from recorded events; no demographics are collected or shown. */
export const getAudienceInsights = async (userId: string, now = new Date()) => {
  await assertPlanFeature(userId, 'audienceInsights', now);

  const days = lastDays(30, now);
  const where = { agentId: userId, day: { gte: days[0] as string, lte: days[days.length - 1] as string } };
  const [byHour, byDayType, signedIn, stats] = await Promise.all([
    prisma.houseEvent.groupBy({ by: ['hour'], where: { ...where, type: 'VIEW' }, _count: { _all: true } }),
    prisma.houseEvent.groupBy({ by: ['day'], where: { ...where, type: 'VIEW' }, _count: { _all: true } }),
    prisma.houseEvent.groupBy({ by: ['signedIn'], where: { ...where, type: 'VIEW' }, _count: { _all: true } }),
    collect(userId, days[0] as string, days[days.length - 1] as string)
  ]);

  const weekdays = Array.from({ length: 7 }, () => 0);
  for (const row of byDayType) {
    const weekday = new Date(`${row.day}T00:00:00.000Z`).getUTCDay();
    weekdays[weekday] = (weekdays[weekday] ?? 0) + row._count._all;
  }

  const hours = Array.from({ length: 24 }, (_, hour) => byHour.find((row) => row.hour === hour)?._count._all ?? 0);
  const signedInViews = signedIn.find((row) => row.signedIn)?._count._all ?? 0;
  const { totals } = stats;

  return {
    rangeDays: 30,
    totalViews: totals.views,
    viewsByHour: hours,
    viewsByWeekday: weekdays,
    signedInViews,
    guestViews: Math.max(0, totals.views - signedInViews),
    contactMethods: { calls: totals.calls, telegram: totals.telegram, viber: totals.viber, bookings: totals.bookings },
    viewToInquiryRate: totals.views > 0 ? Math.round((totals.inquiries / totals.views) * 1000) / 10 : null,
    topListings: (await houseBreakdown(userId, stats.byHouse)).slice(0, 5)
  };
};

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Gold only. A report for one Asia/Yangon calendar month, compared with the month before. */
export const getMonthlyReport = async (userId: string, month: string | undefined, now = new Date()) => {
  await assertPlanFeature(userId, 'monthlyReport', now);

  const currentMonth = yangonMonthRange(now).month;
  const target = month ?? currentMonth;
  if (!MONTH_REGEX.test(target) || target > currentMonth) {
    throw new ApiError(400, 'REPORT_MONTH_INVALID', 'Choose a past or current month in YYYY-MM format.');
  }

  const rangeFor = (value: string) => {
    const [year, monthNumber] = value.split('-').map(Number) as [number, number];
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return { from: `${value}-01`, to: `${value}-${String(lastDay).padStart(2, '0')}` };
  };
  const previousOf = (value: string) => {
    const [year, monthNumber] = value.split('-').map(Number) as [number, number];
    const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
    return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const range = rangeFor(target);
  const previousMonth = previousOf(target);
  const previousRange = rangeFor(previousMonth);
  const [stats, previous, newListings] = await Promise.all([
    collect(userId, range.from, range.to),
    collect(userId, previousRange.from, previousRange.to),
    prisma.house.count({ where: { agentId: userId, createdAt: { gte: dayStart(range.from), lt: new Date(dayStart(range.to).getTime() + DAY_MS) } } })
  ]);

  return {
    month: target,
    isPartial: target === currentMonth,
    totals: stats.totals,
    previousMonth,
    previousTotals: previous.totals,
    newListings,
    listings: await houseBreakdown(userId, stats.byHouse)
  };
};
