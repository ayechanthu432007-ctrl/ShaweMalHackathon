import { ListingCondition, ListingPickupMethod, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { isValidUploadedPath, MARKETPLACE_MAX_PHOTOS } from '../utils/upload-path';
import { writeAuditLog } from './audit.service';
import {
  availableContactMethods,
  findProhibitedKeywords,
  LISTING_CARD_INCLUDE,
  mapListingCard,
  requireActiveMarketplaceUser,
  resolveSellerContactValues,
  sellerBadges
} from './marketplace-shared';
import { yangonMonthRange } from './subscription.service';
import { marketplaceVariantPaths } from './upload.service';

export interface ListingInput {
  title: string;
  description: string;
  categoryId: string;
  subcategoryId?: string | null;
  price: number;
  condition: ListingCondition;
  cityId: string;
  locationDetail?: string | null;
  pickupMethod: ListingPickupMethod;
  images: string[];
  coverIndex: number;
  showPhone: boolean;
  showTelegram: boolean;
  showViber: boolean;
  movingOutSaleId?: string | null;
  policyAccepted: boolean;
}

const PHONE_VERIFICATION_REQUEST_ACTION = 'MARKETPLACE_PHONE_VERIFICATION_REQUESTED';

const nullableTrim = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const getMySellerStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      accountStatus: true,
      phoneVerifiedAt: true,
      identityVerifiedAt: true,
      trustedSellerAt: true,
      sellerContact: true
    }
  });

  if (!user) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'User account was not found.');
  }

  const lastRequest = user.phoneVerifiedAt
    ? null
    : await prisma.auditLog.findFirst({
        where: { action: PHONE_VERIFICATION_REQUEST_ACTION, targetId: userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });

  return {
    accountStatus: user.accountStatus,
    badges: sellerBadges(user),
    // Phone verification is an optional trust badge; any active account may sell.
    canSell: user.accountStatus === 'ACTIVE',
    phoneVerificationRequestedAt: lastRequest?.createdAt ?? null,
    contact: {
      phone: user.sellerContact?.phone ?? user.phone,
      telegramUsername: user.sellerContact?.telegramUsername ?? null,
      viberNumber: user.sellerContact?.viberNumber ?? null,
      showPhone: user.sellerContact?.showPhone ?? true,
      showTelegram: user.sellerContact?.showTelegram ?? true,
      showViber: user.sellerContact?.showViber ?? true
    }
  };
};

export const requestPhoneVerification = async (userId: string) => {
  const user = await requireActiveMarketplaceUser(userId);
  if (user.phoneVerifiedAt) {
    throw new ApiError(409, 'PHONE_ALREADY_VERIFIED', 'Your phone number is already verified.');
  }

  const recent = await prisma.auditLog.findFirst({
    where: {
      action: PHONE_VERIFICATION_REQUEST_ACTION,
      targetId: userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    select: { id: true }
  });

  if (!recent) {
    const admins = await prisma.user.findMany({
      where: { userRoles: { some: { role: { name: 'admin' } } } },
      select: { id: true }
    });

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: 'Phone verification requested',
        message: `${user.name} (${user.phone}) asked to verify their phone number to sell on the marketplace.`
      }))
    });

    await writeAuditLog({
      actorUserId: userId,
      action: PHONE_VERIFICATION_REQUEST_ACTION,
      targetType: 'User',
      targetId: userId
    });
  }

  return getMySellerStatus(userId);
};

export const updateMySellerContact = async (
  userId: string,
  input: {
    phone?: string | null;
    telegramUsername?: string | null;
    viberNumber?: string | null;
    showPhone: boolean;
    showTelegram: boolean;
    showViber: boolean;
  }
) => {
  await requireActiveMarketplaceUser(userId);

  const data = {
    phone: nullableTrim(input.phone),
    telegramUsername: nullableTrim(input.telegramUsername)?.replace(/^@/, '') ?? null,
    viberNumber: nullableTrim(input.viberNumber),
    showPhone: input.showPhone,
    showTelegram: input.showTelegram,
    showViber: input.showViber
  };

  await prisma.sellerContact.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data }
  });

  return getMySellerStatus(userId);
};

/** Any signed-in user in good standing may sell; no admin verification is needed first. */
const requireSeller = requireActiveMarketplaceUser;

const resolveListingData = async (userId: string, accountPhone: string, input: ListingInput) => {
  if (!input.policyAccepted) {
    throw new ApiError(400, 'MARKETPLACE_POLICY_NOT_ACCEPTED', 'You must accept the marketplace policy before publishing.');
  }

  if (input.images.length === 0 || input.images.length > MARKETPLACE_MAX_PHOTOS) {
    throw new ApiError(400, 'LISTING_PHOTOS_INVALID', `Add between 1 and ${MARKETPLACE_MAX_PHOTOS} photos.`);
  }

  if (input.images.some((path) => !isValidUploadedPath(path, 'marketplace'))) {
    throw new ApiError(400, 'LISTING_PHOTOS_INVALID', 'Photos must be uploaded to the marketplace category.');
  }

  if (new Set(input.images).size !== input.images.length) {
    throw new ApiError(400, 'LISTING_PHOTOS_INVALID', 'The same photo was added twice.');
  }

  if (input.coverIndex < 0 || input.coverIndex >= input.images.length) {
    throw new ApiError(400, 'LISTING_COVER_INVALID', 'Cover photo must be one of the listing photos.');
  }

  const category = await prisma.marketplaceCategory.findFirst({
    where: { id: input.categoryId, parentId: null, isActive: true },
    include: { children: { where: { isActive: true }, select: { id: true } } }
  });

  if (!category) {
    throw new ApiError(400, 'LISTING_CATEGORY_INVALID', 'Choose a category from the list.');
  }

  const subcategoryId = input.subcategoryId ?? null;
  if (category.children.length > 0 && !subcategoryId) {
    throw new ApiError(400, 'LISTING_SUBCATEGORY_REQUIRED', 'Choose a subcategory for this category.');
  }

  if (subcategoryId && !category.children.some((child) => child.id === subcategoryId)) {
    throw new ApiError(400, 'LISTING_SUBCATEGORY_INVALID', 'Subcategory does not belong to the selected category.');
  }

  const city = await prisma.city.findFirst({ where: { id: input.cityId, isActive: true }, select: { id: true, stateId: true } });
  if (!city) {
    throw new ApiError(400, 'LISTING_TOWNSHIP_INVALID', 'Choose a township from the list.');
  }

  if (input.movingOutSaleId) {
    const sale = await prisma.movingOutSale.findFirst({ where: { id: input.movingOutSaleId, sellerId: userId }, select: { id: true } });
    if (!sale) {
      throw new ApiError(400, 'MOVING_OUT_SALE_INVALID', 'Moving-out sale not found.');
    }
  }

  const contact = await prisma.sellerContact.findUnique({ where: { userId } });
  const methods = availableContactMethods(input, resolveSellerContactValues(contact, accountPhone));
  if (methods.length === 0) {
    throw new ApiError(400, 'LISTING_CONTACT_REQUIRED', 'Enable at least one contact method that has contact details.');
  }

  const prohibitedHits = findProhibitedKeywords(input.title, input.description, input.locationDetail);

  return {
    scalars: {
      title: input.title.trim(),
      description: input.description.trim(),
      categoryId: category.id,
      subcategoryId,
      price: new Prisma.Decimal(input.price),
      condition: input.condition,
      stateId: city.stateId,
      cityId: city.id,
      locationDetail: nullableTrim(input.locationDetail),
      pickupMethod: input.pickupMethod,
      showPhone: input.showPhone,
      showTelegram: input.showTelegram,
      showViber: input.showViber,
      movingOutSaleId: input.movingOutSaleId ?? null
    },
    images: input.images.map((imagePath, index) => ({
      imagePath,
      ...marketplaceVariantPaths(imagePath),
      displayOrder: index,
      isCover: index === input.coverIndex
    })),
    prohibitedHits
  };
};

/**
 * Listings publish immediately. A prohibited-keyword hit no longer holds the listing;
 * admins are told about it so they can review (and remove) it after the fact.
 */
const notifyAdminsOfFlaggedListing = async (listingId: string, title: string, hits: string[]) => {
  const admins = await prisma.user.findMany({
    where: { userRoles: { some: { role: { name: 'admin' } } } },
    select: { id: true }
  });

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: 'Marketplace listing flagged',
      message: `"${title}" (listing ${listingId}) mentions possibly prohibited items (${hits.slice(0, 5).join(', ')}). It is live; please review it.`
    }))
  });
};

/** New Marketplace posts each person may publish per Asia/Yangon calendar month. */
export const MARKETPLACE_MONTHLY_POST_LIMIT = 5;
export const MARKETPLACE_LISTING_CREATED_ACTION = 'MARKETPLACE_LISTING_CREATED';

/**
 * Posts created this month. Creations are counted from the audit log, so deleting a post does
 * not hand the slot back and editing never uses one; posts that predate the log are counted from
 * the listings that still exist.
 */
export const getMarketplacePostQuota = async (userId: string, now = new Date()) => {
  const range = yangonMonthRange(now);
  const createdAt = { gte: range.start, lt: range.end };
  const [logged, existing] = await Promise.all([
    prisma.auditLog.count({ where: { actorUserId: userId, action: MARKETPLACE_LISTING_CREATED_ACTION, createdAt } }),
    prisma.listing.count({ where: { sellerId: userId, createdAt } })
  ]);
  // A missing count is treated as zero, never as "no limit".
  const used = Math.max(Number(logged) || 0, Number(existing) || 0);
  return {
    month: range.month,
    used,
    limit: MARKETPLACE_MONTHLY_POST_LIMIT,
    remaining: Math.max(0, MARKETPLACE_MONTHLY_POST_LIMIT - used),
    resetsAt: range.end.toISOString()
  };
};

export const createMyListing = async (userId: string, input: ListingInput) => {
  const quota = await getMarketplacePostQuota(userId);
  if (quota.remaining <= 0) {
    throw new ApiError(
      403,
      'MARKETPLACE_MONTHLY_LIMIT_REACHED',
      `You have used all ${MARKETPLACE_MONTHLY_POST_LIMIT} Marketplace posts for this month. New posts open again next month.`
    );
  }

  const seller = await requireSeller(userId);
  const resolved = await resolveListingData(userId, seller.phone, input);
  const now = new Date();

  const listing = await prisma.listing.create({
    data: {
      ...resolved.scalars,
      sellerId: userId,
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      policyAcceptedAt: now,
      publishedAt: now,
      images: { create: resolved.images }
    }
  });

  await writeAuditLog({ actorUserId: userId, action: MARKETPLACE_LISTING_CREATED_ACTION, targetType: 'Listing', targetId: listing.id });

  if (resolved.prohibitedHits.length > 0) {
    await notifyAdminsOfFlaggedListing(listing.id, listing.title, resolved.prohibitedHits);
  }

  return { id: listing.id, status: listing.status, moderationStatus: listing.moderationStatus };
};

const findOwnedListing = async (userId: string, listingId: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true, moderationStatus: true, publishedAt: true, review: { select: { id: true } } }
  });

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  if (listing.sellerId !== userId) {
    throw new ApiError(403, 'LISTING_FORBIDDEN', 'You can only manage your own listings.');
  }

  return listing;
};

export const getMyListingForEdit = async (userId: string, listingId: string) => {
  await findOwnedListing(userId, listingId);
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      city: { select: { id: true, name: true, stateId: true } }
    }
  });

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    subcategoryId: listing.subcategoryId,
    price: Number(listing.price),
    condition: listing.condition,
    stateId: listing.stateId,
    cityId: listing.cityId,
    locationDetail: listing.locationDetail,
    pickupMethod: listing.pickupMethod,
    images: listing.images.map((image) => image.imagePath),
    coverIndex: Math.max(0, listing.images.findIndex((image) => image.isCover)),
    showPhone: listing.showPhone,
    showTelegram: listing.showTelegram,
    showViber: listing.showViber,
    movingOutSaleId: listing.movingOutSaleId,
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    moderationNote: listing.moderationNote
  };
};

export const updateMyListing = async (userId: string, listingId: string, input: ListingInput) => {
  const seller = await requireSeller(userId);
  const existing = await findOwnedListing(userId, listingId);

  if (existing.moderationStatus === 'REMOVED') {
    throw new ApiError(403, 'LISTING_REMOVED', 'This listing was removed by an admin and cannot be edited.');
  }

  const resolved = await resolveListingData(userId, seller.phone, input);

  // Listings an admin rejected go back to the admin's review queue after the seller fixes them.
  const moderationStatus = existing.moderationStatus === 'REJECTED' || existing.moderationStatus === 'PENDING' ? 'PENDING' : 'APPROVED';
  const moderationNote = moderationStatus === 'PENDING' ? 'Updated by seller; awaiting review.' : null;

  await prisma.$transaction([
    prisma.listingImage.deleteMany({ where: { listingId } }),
    prisma.listing.update({
      where: { id: listingId },
      data: {
        ...resolved.scalars,
        moderationStatus,
        moderationNote,
        policyAcceptedAt: new Date(),
        publishedAt: moderationStatus === 'APPROVED' ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
        images: { create: resolved.images }
      }
    })
  ]);

  if (resolved.prohibitedHits.length > 0 && moderationStatus === 'APPROVED') {
    await notifyAdminsOfFlaggedListing(listingId, resolved.scalars.title, resolved.prohibitedHits);
  }

  return { id: listingId, moderationStatus };
};

export const deleteMyListing = async (userId: string, listingId: string) => {
  await findOwnedListing(userId, listingId);
  await prisma.listing.delete({ where: { id: listingId } });
};

export const listInterestedBuyers = async (userId: string, listingId: string) => {
  await findOwnedListing(userId, listingId);
  const reveals = await prisma.listingContactReveal.findMany({
    where: { listingId },
    include: { user: { select: { id: true, name: true, profilePicturePath: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const buyers = new Map<string, { id: string; name: string; profilePicturePath: string | null; contactedAt: Date }>();
  for (const reveal of reveals) {
    if (!buyers.has(reveal.userId)) {
      buyers.set(reveal.userId, { ...reveal.user, contactedAt: reveal.createdAt });
    }
  }

  return [...buyers.values()];
};

export const updateMyListingStatus = async (userId: string, listingId: string, input: { status: 'ACTIVE' | 'SOLD'; buyerId?: string | null }) => {
  await requireActiveMarketplaceUser(userId);
  const listing = await findOwnedListing(userId, listingId);

  if (input.status === 'SOLD') {
    if (input.buyerId) {
      const contacted = await prisma.listingContactReveal.findFirst({
        where: { listingId, userId: input.buyerId },
        select: { id: true }
      });
      if (!contacted) {
        throw new ApiError(400, 'LISTING_BUYER_INVALID', 'The buyer must be someone who contacted you about this item.');
      }
    }

    await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'SOLD', soldAt: new Date(), buyerId: input.buyerId ?? null }
    });

    if (input.buyerId) {
      await prisma.notification.create({
        data: {
          userId: input.buyerId,
          title: 'Rate your purchase',
          message: 'A seller marked an item you contacted them about as sold to you. You can now leave a review.'
        }
      });
    }

    return { id: listingId, status: 'SOLD' as const };
  }

  if (listing.review) {
    throw new ApiError(409, 'LISTING_ALREADY_REVIEWED', 'A reviewed sale cannot be reopened.');
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { status: 'ACTIVE', soldAt: null, buyerId: null }
  });

  return { id: listingId, status: 'ACTIVE' as const };
};

export const getMyMarketplaceDashboard = async (userId: string, filter: { status?: 'ACTIVE' | 'SOLD' }) => {
  const [activeCount, soldCount, pendingCount, listings, movingOutSales, postQuota] = await Promise.all([
    prisma.listing.count({ where: { sellerId: userId, status: 'ACTIVE' } }),
    prisma.listing.count({ where: { sellerId: userId, status: 'SOLD' } }),
    prisma.listing.count({ where: { sellerId: userId, moderationStatus: { in: ['PENDING', 'REJECTED', 'REMOVED'] } } }),
    prisma.listing.findMany({
      where: { sellerId: userId, ...(filter.status ? { status: filter.status } : {}) },
      include: { ...LISTING_CARD_INCLUDE, _count: { select: { contactReveals: true, wishlists: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    listMyMovingOutSales(userId),
    getMarketplacePostQuota(userId)
  ]);

  return {
    postQuota,
    activeCount,
    soldCount,
    needsAttentionCount: pendingCount,
    listings: listings.map((listing) => ({
      ...mapListingCard(listing),
      moderationNote: listing.moderationNote,
      contactCount: listing._count.contactReveals,
      saveCount: listing._count.wishlists
    })),
    movingOutSales
  };
};

export interface MovingOutSaleInput {
  title: string;
  description?: string | null;
  originCityId: string;
  destinationCityId?: string | null;
  moveOutDate?: string | null;
  isActive: boolean;
}

const assertCities = async (ids: Array<string | null | undefined>) => {
  const wanted = ids.filter((id): id is string => Boolean(id));
  const count = await prisma.city.count({ where: { id: { in: wanted } } });
  if (count !== new Set(wanted).size) {
    throw new ApiError(400, 'TOWNSHIP_INVALID', 'Choose townships from the list.');
  }
};

export const listMyMovingOutSales = async (userId: string) => {
  const sales = await prisma.movingOutSale.findMany({
    where: { sellerId: userId },
    include: {
      originCity: { select: { id: true, name: true } },
      destinationCity: { select: { id: true, name: true } },
      _count: { select: { listings: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return sales.map((sale) => ({
    id: sale.id,
    title: sale.title,
    description: sale.description,
    originCity: sale.originCity,
    destinationCity: sale.destinationCity,
    moveOutDate: sale.moveOutDate,
    isActive: sale.isActive,
    listingCount: sale._count.listings,
    createdAt: sale.createdAt
  }));
};

export const saveMyMovingOutSale = async (userId: string, input: MovingOutSaleInput, saleId?: string) => {
  await requireSeller(userId);
  await assertCities([input.originCityId, input.destinationCityId]);

  const data = {
    title: input.title.trim(),
    description: nullableTrim(input.description),
    originCityId: input.originCityId,
    destinationCityId: input.destinationCityId ?? null,
    moveOutDate: input.moveOutDate ? new Date(input.moveOutDate) : null,
    isActive: input.isActive
  };

  if (!saleId) {
    const sale = await prisma.movingOutSale.create({ data: { ...data, sellerId: userId } });
    return { id: sale.id };
  }

  const existing = await prisma.movingOutSale.findUnique({ where: { id: saleId }, select: { sellerId: true } });
  if (!existing) {
    throw new ApiError(404, 'MOVING_OUT_SALE_NOT_FOUND', 'Moving-out sale not found.');
  }
  if (existing.sellerId !== userId) {
    throw new ApiError(403, 'MOVING_OUT_SALE_FORBIDDEN', 'You can only manage your own moving-out sales.');
  }

  await prisma.movingOutSale.update({ where: { id: saleId }, data });
  return { id: saleId };
};

export const deleteMyMovingOutSale = async (userId: string, saleId: string) => {
  const existing = await prisma.movingOutSale.findUnique({ where: { id: saleId }, select: { sellerId: true } });
  if (!existing) {
    throw new ApiError(404, 'MOVING_OUT_SALE_NOT_FOUND', 'Moving-out sale not found.');
  }
  if (existing.sellerId !== userId) {
    throw new ApiError(403, 'MOVING_OUT_SALE_FORBIDDEN', 'You can only manage your own moving-out sales.');
  }

  // Listings stay published; they are simply detached from the sale (onDelete: SetNull).
  await prisma.movingOutSale.delete({ where: { id: saleId } });
};
