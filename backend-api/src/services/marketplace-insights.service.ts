import { createHash } from 'node:crypto';

import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { writeAuditLog } from './audit.service';
import { getSellerEffectivePlan } from './marketplace-plan.service';
import { PUBLIC_LISTING_WHERE, requireActiveMarketplaceUser } from './marketplace-shared';
import { yangonDayAndHour } from './subscription.service';

/**
 * Metric definitions shown to sellers:
 * - View: a product's detail page opened by a visitor, counted once per visitor, per product,
 *   per day. Refreshes do not add views, the seller's own visits are not counted, and requests
 *   that identify themselves as bots are ignored.
 * - Inquiry: a written question a signed-in buyer sent about a product.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const BOT_PATTERN = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|curl|wget|python-requests/i;

/** Daily-rotating salted hash: enough to de-duplicate, useless for identifying anyone. */
const visitorKeyFor = (day: string, ip: string, userAgent: string, userId?: string): string =>
  createHash('sha256').update(`${env.jwtSecret}|listing|${day}|${userId ?? `${ip}|${userAgent}`}`).digest('hex').slice(0, 32);

export const recordListingView = async (input: { listingId: string; ip: string; userAgent: string; viewerUserId?: string }, now = new Date()) => {
  if (!input.userAgent || BOT_PATTERN.test(input.userAgent)) {
    return { recorded: false };
  }

  const listing = await prisma.listing.findFirst({ where: { AND: [{ id: input.listingId }, PUBLIC_LISTING_WHERE] }, select: { id: true, sellerId: true } });
  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }
  if (input.viewerUserId === listing.sellerId) {
    return { recorded: false };
  }

  const { day } = yangonDayAndHour(now);
  const result = await prisma.listingEvent.createMany({
    data: [
      {
        listingId: listing.id,
        sellerId: listing.sellerId,
        type: 'VIEW',
        visitorKey: visitorKeyFor(day, input.ip, input.userAgent, input.viewerUserId),
        day,
        signedIn: Boolean(input.viewerUserId)
      }
    ],
    skipDuplicates: true
  });
  return { recorded: result.count > 0 };
};

const dayOf = (date: Date) => yangonDayAndHour(date).day;
const lastDays = (days: number, now: Date): string[] =>
  Array.from({ length: days }, (_, index) => dayOf(new Date(now.getTime() - (days - 1 - index) * DAY_MS)));

/** Basic (Free Seller) insights cover 7 days; Premium's detailed insights allow up to 90. */
export const INSIGHT_RANGES = { BASIC: [7], DETAILED: [7, 30, 90] } as const;

export const getSellerInsights = async (userId: string, requestedDays: number, now = new Date()) => {
  const { plan } = await getSellerEffectivePlan(userId, now);
  const level = plan.performanceLevel === 'DETAILED' ? 'DETAILED' : 'BASIC';
  const allowed: readonly number[] = INSIGHT_RANGES[level];
  const days = allowed.includes(requestedDays) ? requestedDays : (allowed[0] as number);
  const range = lastDays(days, now);
  const fromDay = range[0];

  const [listings, viewRows, inquiryRows, firstEvent, allTimeViews] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: userId },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.listingEvent.groupBy({ by: ['day', 'listingId'], where: { sellerId: userId, type: 'VIEW', day: { gte: fromDay } }, _count: { _all: true } }),
    prisma.listingInquiry.findMany({ where: { sellerId: userId, createdAt: { gte: new Date(now.getTime() - days * DAY_MS) } }, select: { listingId: true, createdAt: true } }),
    prisma.listingEvent.findFirst({ where: { sellerId: userId }, orderBy: { day: 'asc' }, select: { day: true } }),
    prisma.listingEvent.groupBy({ by: ['listingId'], where: { sellerId: userId, type: 'VIEW' }, _count: { _all: true } })
  ]);

  // View tracking for Marketplace products starts with this release. Days before the first
  // recorded event (and before any product existed) are "no data", not zero.
  const earliestListing = listings.reduce<Date | null>((min, item) => (!min || item.createdAt < min ? item.createdAt : min), null);
  const trackingSince = firstEvent?.day ?? (earliestListing ? dayOf(now) : null);

  const viewsByDay = new Map<string, number>();
  const viewsByListing = new Map<string, number>();
  for (const row of viewRows) {
    viewsByDay.set(row.day, (viewsByDay.get(row.day) ?? 0) + row._count._all);
    viewsByListing.set(row.listingId, (viewsByListing.get(row.listingId) ?? 0) + row._count._all);
  }
  const inquiriesByDay = new Map<string, number>();
  const inquiriesByListing = new Map<string, number>();
  for (const row of inquiryRows) {
    const day = dayOf(row.createdAt);
    inquiriesByDay.set(day, (inquiriesByDay.get(day) ?? 0) + 1);
    inquiriesByListing.set(row.listingId, (inquiriesByListing.get(row.listingId) ?? 0) + 1);
  }
  const allTime = new Map(allTimeViews.map((row) => [row.listingId, row._count._all]));

  const series = range.map((day) => {
    const tracked = trackingSince !== null && day >= trackingSince;
    return { day, views: tracked ? (viewsByDay.get(day) ?? 0) : null, inquiries: tracked ? (inquiriesByDay.get(day) ?? 0) : null };
  });

  const products = listings.map((listing) => {
    const views = viewsByListing.get(listing.id) ?? 0;
    const inquiries = inquiriesByListing.get(listing.id) ?? 0;
    return {
      listing: { id: listing.id, title: listing.title, status: listing.status },
      views,
      inquiries,
      totalViews: allTime.get(listing.id) ?? 0,
      inquiryRate: views > 0 ? Math.round((inquiries / views) * 1000) / 10 : null
    };
  });

  const totals = {
    views: [...viewsByListing.values()].reduce((sum, value) => sum + value, 0),
    inquiries: inquiryRows.length,
    allTimeViews: [...allTime.values()].reduce((sum, value) => sum + value, 0)
  };

  const detailed = level === 'DETAILED';
  return {
    level,
    days,
    availableRanges: allowed,
    trackingSince,
    totals,
    products: detailed ? products : products.map((item) => ({ ...item, inquiryRate: null })),
    // Day-by-day trends and best performers are part of Premium's detailed insights.
    series: detailed ? series : null,
    bestPerforming: detailed
      ? [...products].filter((item) => item.views + item.inquiries > 0).sort((a, b) => b.inquiries - a.inquiries || b.views - a.views).slice(0, 5)
      : null
  };
};

// --- Buyer inquiries ---

export const INQUIRY_STATUSES = ['NEW', 'REPLIED', 'CLOSED'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/** A signed-in buyer asks about a live product. Asking again updates the same thread. */
export const createListingInquiry = async (buyerId: string, listingId: string, message: string) => {
  const buyer = await requireActiveMarketplaceUser(buyerId);
  const listing = await prisma.listing.findFirst({
    where: { AND: [{ id: listingId }, PUBLIC_LISTING_WHERE, { status: 'ACTIVE' }] },
    select: { id: true, sellerId: true, title: true }
  });
  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'This item is no longer available.');
  }
  if (listing.sellerId === buyerId) {
    throw new ApiError(400, 'INQUIRY_OWN_LISTING', 'You cannot send an inquiry about your own item.');
  }

  const text = message.trim();
  const inquiry = await prisma.listingInquiry.upsert({
    where: { listingId_buyerId: { listingId, buyerId } },
    create: { listingId, sellerId: listing.sellerId, buyerId, message: text },
    update: { message: text, status: 'NEW', readAt: null }
  });

  await prisma.notification.create({
    data: { userId: listing.sellerId, title: 'New buyer inquiry', message: `${buyer.name} asked about "${listing.title}".` }
  });

  return { id: inquiry.id, status: inquiry.status, createdAt: inquiry.createdAt };
};

/** The buyer's own inquiry on a product (so the detail page can show the seller's reply). */
export const getMyInquiryForListing = async (buyerId: string, listingId: string) => {
  const inquiry = await prisma.listingInquiry.findUnique({ where: { listingId_buyerId: { listingId, buyerId } } });
  return inquiry
    ? { id: inquiry.id, message: inquiry.message, status: inquiry.status, sellerReply: inquiry.sellerReply, repliedAt: inquiry.repliedAt, createdAt: inquiry.createdAt }
    : null;
};

export const listSellerInquiries = async (sellerId: string, filter: { status?: InquiryStatus }) => {
  const [items, counts] = await Promise.all([
    prisma.listingInquiry.findMany({
      where: { sellerId, ...(filter.status ? { status: filter.status } : {}) },
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, profilePicturePath: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    }),
    prisma.listingInquiry.groupBy({ by: ['status'], where: { sellerId }, _count: { _all: true } })
  ]);

  return {
    counts: Object.fromEntries(INQUIRY_STATUSES.map((status) => [status, counts.find((row) => row.status === status)?._count._all ?? 0])),
    unread: await prisma.listingInquiry.count({ where: { sellerId, readAt: null } }),
    items: items.map((item) => ({
      id: item.id,
      listing: item.listing,
      buyer: item.buyer,
      message: item.message,
      status: item.status,
      sellerReply: item.sellerReply,
      read: Boolean(item.readAt),
      repliedAt: item.repliedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  };
};

/** Seller reads, replies to, or closes an inquiry on their own product. A reply notifies the buyer. */
export const updateSellerInquiry = async (sellerId: string, inquiryId: string, input: { status?: InquiryStatus; reply?: string; read?: boolean }) => {
  const inquiry = await prisma.listingInquiry.findUnique({ where: { id: inquiryId }, include: { listing: { select: { title: true } } } });
  if (!inquiry) {
    throw new ApiError(404, 'INQUIRY_NOT_FOUND', 'Inquiry not found.');
  }
  if (inquiry.sellerId !== sellerId) {
    throw new ApiError(403, 'INQUIRY_FORBIDDEN', 'You can only manage inquiries about your own products.');
  }

  const now = new Date();
  const reply = input.reply?.trim();
  const updated = await prisma.listingInquiry.update({
    where: { id: inquiryId },
    data: {
      readAt: input.read === false ? null : (inquiry.readAt ?? now),
      ...(reply ? { sellerReply: reply, repliedAt: now, status: 'REPLIED' } : {}),
      ...(input.status ? { status: input.status } : {})
    }
  });

  if (reply) {
    await prisma.notification.create({
      data: { userId: inquiry.buyerId, title: 'The seller replied', message: `Reply about "${inquiry.listing.title}": ${reply.slice(0, 200)}` }
    });
    await writeAuditLog({ actorUserId: sellerId, action: 'LISTING_INQUIRY_REPLIED', targetType: 'ListingInquiry', targetId: inquiryId });
  }

  return { id: updated.id, status: updated.status, read: Boolean(updated.readAt), sellerReply: updated.sellerReply };
};
