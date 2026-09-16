import { ListingCondition, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import {
  availableContactMethods,
  buildContactLink,
  buildKeywordWhere,
  getSellerRatings,
  LISTING_CARD_INCLUDE,
  LISTING_DETAIL_INCLUDE,
  mapListingCard,
  mapListingDetail,
  mapSellerSummary,
  paginated,
  PUBLIC_LISTING_WHERE,
  requireActiveMarketplaceUser,
  resolveSellerContactValues,
  SELLER_SUMMARY_SELECT,
  type ContactMethod
} from './marketplace-shared';

export type ListingSort = 'newest' | 'price_asc' | 'price_desc';

export interface SearchListingsInput {
  q?: string;
  categoryId?: string;
  subcategoryId?: string;
  condition?: ListingCondition;
  stateId?: string;
  cityId?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
  movingOutSaleId?: string;
  status?: 'ACTIVE' | 'SOLD';
  sort: ListingSort;
  page: number;
  pageSize: number;
}

/** Top-level categories used for relocation-focused recommendations, most useful first. */
const RELOCATION_CATEGORY_SLUGS = ['furniture', 'study', 'electronics', 'kitchen', 'bedroom', 'home-essentials'];

const mapCardsWithRatings = async (listings: Array<Prisma.ListingGetPayload<{ include: typeof LISTING_CARD_INCLUDE }>>) => {
  const ratings = await getSellerRatings(listings.map((listing) => listing.sellerId));
  return listings.map((listing) => mapListingCard(listing, ratings));
};

const toOrderBy = (sort: ListingSort): Prisma.ListingOrderByWithRelationInput[] => {
  if (sort === 'price_asc') return [{ price: 'asc' }, { publishedAt: 'desc' }];
  if (sort === 'price_desc') return [{ price: 'desc' }, { publishedAt: 'desc' }];
  return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
};

export const listMarketplaceCategories = async () => {
  const categories = await prisma.marketplaceCategory.findMany({
    where: { parentId: null, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, nameMy: true, slug: true }
      }
    }
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    nameMy: category.nameMy,
    slug: category.slug,
    children: category.children
  }));
};

export const searchListings = async (input: SearchListingsInput) => {
  const conditions: Prisma.ListingWhereInput[] = [PUBLIC_LISTING_WHERE, { status: input.status ?? 'ACTIVE' }];

  const keywordWhere = buildKeywordWhere(input.q);
  if (keywordWhere) conditions.push(keywordWhere);
  if (input.categoryId) conditions.push({ categoryId: input.categoryId });
  if (input.subcategoryId) conditions.push({ subcategoryId: input.subcategoryId });
  if (input.condition) conditions.push({ condition: input.condition });
  if (input.stateId) conditions.push({ stateId: input.stateId });
  if (input.cityId) conditions.push({ cityId: input.cityId });
  if (input.sellerId) conditions.push({ sellerId: input.sellerId });
  if (input.movingOutSaleId) conditions.push({ movingOutSaleId: input.movingOutSaleId });
  if (typeof input.minPrice === 'number') conditions.push({ price: { gte: new Prisma.Decimal(input.minPrice) } });
  if (typeof input.maxPrice === 'number') conditions.push({ price: { lte: new Prisma.Decimal(input.maxPrice) } });

  const where: Prisma.ListingWhereInput = { AND: conditions };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: LISTING_CARD_INCLUDE,
      orderBy: toOrderBy(input.sort),
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    }),
    prisma.listing.count({ where })
  ]);

  return paginated(await mapCardsWithRatings(items), input.page, input.pageSize, total);
};

export const getRecommendedListings = async (options: { userId?: string; destinationCityId?: string; limit: number }) => {
  let destinationCityId = options.destinationCityId;
  if (!destinationCityId && options.userId) {
    const preference = await prisma.relocationPreference.findUnique({
      where: { userId: options.userId },
      select: { destinationCityId: true, status: true }
    });
    if (preference && preference.status !== 'SETTLED') {
      destinationCityId = preference.destinationCityId;
    }
  }

  const baseWhere: Prisma.ListingWhereInput = {
    AND: [
      PUBLIC_LISTING_WHERE,
      { status: 'ACTIVE' },
      ...(options.userId ? [{ sellerId: { not: options.userId } }] : []),
      { category: { slug: { in: RELOCATION_CATEGORY_SLUGS } } }
    ]
  };

  const picked: Array<Prisma.ListingGetPayload<{ include: typeof LISTING_CARD_INCLUDE }>> = [];

  if (destinationCityId) {
    const destination = await prisma.city.findUnique({ where: { id: destinationCityId }, select: { stateId: true } });

    // Items in the destination township first, then the rest of the same region.
    picked.push(
      ...(await prisma.listing.findMany({
        where: { AND: [baseWhere, { cityId: destinationCityId }] },
        include: LISTING_CARD_INCLUDE,
        orderBy: { publishedAt: 'desc' },
        take: options.limit
      }))
    );

    if (destination && picked.length < options.limit) {
      picked.push(
        ...(await prisma.listing.findMany({
          where: { AND: [baseWhere, { stateId: destination.stateId }, { id: { notIn: picked.map((item) => item.id) } }] },
          include: LISTING_CARD_INCLUDE,
          orderBy: { publishedAt: 'desc' },
          take: options.limit - picked.length
        }))
      );
    }
  }

  if (picked.length < options.limit) {
    picked.push(
      ...(await prisma.listing.findMany({
        where: { AND: [baseWhere, { id: { notIn: picked.map((item) => item.id) } }] },
        include: LISTING_CARD_INCLUDE,
        orderBy: { publishedAt: 'desc' },
        take: options.limit - picked.length
      }))
    );
  }

  return {
    destinationCityId: destinationCityId ?? null,
    items: await mapCardsWithRatings(picked)
  };
};

const listVerifiedSellers = async (limit: number) => {
  const sellers = await prisma.user.findMany({
    where: {
      accountStatus: 'ACTIVE',
      OR: [{ identityVerifiedAt: { not: null } }, { trustedSellerAt: { not: null } }],
      listings: { some: { status: 'ACTIVE', moderationStatus: 'APPROVED' } }
    },
    select: {
      ...SELLER_SUMMARY_SELECT,
      _count: {
        select: { listings: { where: { status: 'ACTIVE', moderationStatus: 'APPROVED' } } }
      }
    },
    orderBy: [{ trustedSellerAt: { sort: 'desc', nulls: 'last' } }, { identityVerifiedAt: 'desc' }],
    take: limit
  });

  const ratings = await getSellerRatings(sellers.map((seller) => seller.id));
  return sellers.map((seller) => ({
    ...mapSellerSummary(seller, ratings.get(seller.id)),
    activeListingCount: seller._count.listings
  }));
};

const MOVING_OUT_SALE_INCLUDE = {
  seller: { select: SELLER_SUMMARY_SELECT },
  originCity: { select: { id: true, name: true } },
  destinationCity: { select: { id: true, name: true } },
  listings: {
    where: { status: 'ACTIVE' as const, moderationStatus: 'APPROVED' as const },
    include: { images: { orderBy: [{ isCover: 'desc' as const }, { displayOrder: 'asc' as const }], take: 1 } },
    orderBy: { publishedAt: 'desc' as const },
    take: 4
  },
  _count: { select: { listings: { where: { status: 'ACTIVE' as const, moderationStatus: 'APPROVED' as const } } } }
} satisfies Prisma.MovingOutSaleInclude;

const mapMovingOutSale = (sale: Prisma.MovingOutSaleGetPayload<{ include: typeof MOVING_OUT_SALE_INCLUDE }>) => ({
  id: sale.id,
  title: sale.title,
  description: sale.description,
  originCity: sale.originCity,
  destinationCity: sale.destinationCity,
  moveOutDate: sale.moveOutDate,
  isActive: sale.isActive,
  seller: mapSellerSummary(sale.seller),
  activeListingCount: sale._count.listings,
  previewImages: sale.listings.flatMap((listing) =>
    listing.images[0] ? [listing.images[0].thumbnailPath ?? listing.images[0].imagePath] : []
  ),
  createdAt: sale.createdAt
});

export const listMovingOutSales = async (limit: number) => {
  const sales = await prisma.movingOutSale.findMany({
    where: {
      isActive: true,
      seller: { accountStatus: 'ACTIVE' },
      listings: { some: { status: 'ACTIVE', moderationStatus: 'APPROVED' } }
    },
    include: MOVING_OUT_SALE_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return sales.map(mapMovingOutSale);
};

export const getMovingOutSale = async (saleId: string) => {
  const sale = await prisma.movingOutSale.findFirst({
    where: { id: saleId, seller: { accountStatus: 'ACTIVE' } },
    include: MOVING_OUT_SALE_INCLUDE
  });

  if (!sale) {
    throw new ApiError(404, 'MOVING_OUT_SALE_NOT_FOUND', 'Moving-out sale not found.');
  }

  return mapMovingOutSale(sale);
};

export const getMarketplaceHome = async (userId?: string) => {
  const [categories, recentItems, recommended, verifiedSellers, movingOutSales] = await Promise.all([
    listMarketplaceCategories(),
    prisma.listing.findMany({
      where: { AND: [PUBLIC_LISTING_WHERE, { status: 'ACTIVE' }] },
      include: LISTING_CARD_INCLUDE,
      orderBy: { publishedAt: 'desc' },
      take: 12
    }),
    getRecommendedListings({ userId, limit: 8 }),
    listVerifiedSellers(8),
    listMovingOutSales(6)
  ]);

  return {
    categories,
    recommended: recommended.items,
    recommendedForDestinationCityId: recommended.destinationCityId,
    recentlyListed: await mapCardsWithRatings(recentItems),
    verifiedSellers,
    movingOutSales
  };
};

const loadSellerContactValues = async (sellerId: string) => {
  const seller = await prisma.user.findUniqueOrThrow({
    where: { id: sellerId },
    select: { phone: true, sellerContact: true }
  });
  return resolveSellerContactValues(seller.sellerContact, seller.phone);
};

/** Owners and admins may view listings that are hidden from the public. */
const findViewableListing = async (listingId: string, viewer?: { userId: string; roles: string[] }) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { ...LISTING_DETAIL_INCLUDE, seller: { select: { ...SELLER_SUMMARY_SELECT, accountStatus: true } } }
  });

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  const isPublic = listing.moderationStatus === 'APPROVED' && listing.seller.accountStatus === 'ACTIVE';
  const isOwner = viewer?.userId === listing.sellerId;
  const isAdmin = Boolean(viewer?.roles.includes('admin'));

  if (!isPublic && !isOwner && !isAdmin) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  return { listing, isPublic, isOwner };
};

export const getListingDetail = async (listingId: string, viewer?: { userId: string; roles: string[] }) => {
  const { listing, isOwner } = await findViewableListing(listingId, viewer);
  const [ratings, contactValues, saved] = await Promise.all([
    getSellerRatings([listing.sellerId]),
    loadSellerContactValues(listing.sellerId),
    viewer
      ? prisma.wishlist.findUnique({ where: { userId_listingId: { userId: viewer.userId, listingId } }, select: { id: true } })
      : Promise.resolve(null)
  ]);

  const soldCount = await prisma.listing.count({
    where: { sellerId: listing.sellerId, status: 'SOLD', moderationStatus: 'APPROVED' }
  });

  const detail = mapListingDetail(listing, ratings.get(listing.sellerId), availableContactMethods(listing, contactValues));

  return {
    ...detail,
    seller: { ...detail.seller, soldListingCount: soldCount },
    moderationNote: isOwner ? listing.moderationNote : undefined,
    isOwner,
    isSaved: Boolean(saved),
    canReview: Boolean(viewer && listing.status === 'SOLD' && listing.buyerId === viewer.userId && !listing.review)
  };
};

export const revealListingContact = async (listingId: string, userId: string, method: ContactMethod) => {
  await requireActiveMarketplaceUser(userId);

  const listing = await prisma.listing.findFirst({
    where: { AND: [{ id: listingId }, PUBLIC_LISTING_WHERE] },
    select: { id: true, sellerId: true, status: true, showPhone: true, showTelegram: true, showViber: true }
  });

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  if (listing.status === 'SOLD') {
    throw new ApiError(409, 'LISTING_SOLD', 'This item has already been sold.');
  }

  const values = await loadSellerContactValues(listing.sellerId);
  if (!availableContactMethods(listing, values).includes(method)) {
    throw new ApiError(404, 'CONTACT_METHOD_UNAVAILABLE', 'The seller does not accept this contact method.');
  }

  const value = values[method] as string;

  if (listing.sellerId !== userId) {
    await prisma.listingContactReveal.upsert({
      where: { listingId_userId_method: { listingId, userId, method } },
      update: {},
      create: { listingId, userId, method }
    });
  }

  return { method, value, link: buildContactLink(method, value) };
};

export const getSellerProfile = async (sellerId: string) => {
  const seller = await prisma.user.findFirst({
    where: { id: sellerId, accountStatus: 'ACTIVE', listings: { some: {} } },
    select: SELLER_SUMMARY_SELECT
  });

  if (!seller) {
    throw new ApiError(404, 'SELLER_NOT_FOUND', 'Seller not found.');
  }

  const visible = { sellerId, moderationStatus: 'APPROVED' as const };
  const [ratings, activeCount, soldCount, reviews] = await Promise.all([
    getSellerRatings([sellerId]),
    prisma.listing.count({ where: { ...visible, status: 'ACTIVE' } }),
    prisma.listing.count({ where: { ...visible, status: 'SOLD' } }),
    prisma.ratingReview.findMany({
      where: { targetType: 'SELLER', targetUserId: sellerId },
      include: {
        reviewer: { select: { id: true, name: true, profilePicturePath: true } },
        listing: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  return {
    ...mapSellerSummary(seller, ratings.get(sellerId)),
    listingCount: activeCount + soldCount,
    activeListingCount: activeCount,
    soldListingCount: soldCount,
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewer: review.reviewer,
      listing: review.listing,
      createdAt: review.createdAt
    }))
  };
};

export const createSellerReview = async (input: { listingId: string; reviewerUserId: string; rating: number; comment?: string }) => {
  await requireActiveMarketplaceUser(input.reviewerUserId);

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, sellerId: true, buyerId: true, status: true, review: { select: { id: true } } }
  });

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  if (listing.status !== 'SOLD' || listing.buyerId !== input.reviewerUserId) {
    throw new ApiError(403, 'REVIEW_NOT_ALLOWED', 'Only the buyer of a sold item can review the seller.');
  }

  if (listing.review) {
    throw new ApiError(409, 'REVIEW_ALREADY_EXISTS', 'This purchase has already been reviewed.');
  }

  const comment = input.comment?.trim();
  const review = await prisma.ratingReview.create({
    data: {
      reviewerUserId: input.reviewerUserId,
      targetType: 'SELLER',
      targetUserId: listing.sellerId,
      rating: input.rating,
      comment: comment ? comment : null,
      listingId: listing.id
    }
  });

  await prisma.notification.create({
    data: {
      userId: listing.sellerId,
      title: 'New seller review',
      message: `A buyer left you a ${input.rating}-star review.`
    }
  });

  return review;
};

export const createListingReport = async (input: {
  reporterId: string;
  listingId?: string;
  reportedUserId?: string;
  reason: Prisma.ListingReportCreateInput['reason'];
  description?: string;
}) => {
  if (!input.listingId && !input.reportedUserId) {
    throw new ApiError(400, 'REPORT_TARGET_REQUIRED', 'A listing or a seller must be reported.');
  }

  let reportedUserId = input.reportedUserId;
  if (input.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: input.listingId }, select: { sellerId: true } });
    if (!listing) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }
    reportedUserId = listing.sellerId;
  } else if (reportedUserId) {
    const user = await prisma.user.findUnique({ where: { id: reportedUserId }, select: { id: true } });
    if (!user) {
      throw new ApiError(404, 'SELLER_NOT_FOUND', 'Seller not found.');
    }
  }

  if (reportedUserId === input.reporterId) {
    throw new ApiError(400, 'REPORT_SELF', 'You cannot report yourself.');
  }

  const description = input.description?.trim();
  const report = await prisma.listingReport.create({
    data: {
      reporterId: input.reporterId,
      listingId: input.listingId,
      reportedUserId,
      reason: input.reason,
      description: description ? description : null
    }
  });

  return { id: report.id, status: report.status, createdAt: report.createdAt };
};
