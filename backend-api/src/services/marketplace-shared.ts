import { Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';

/** Listings buyers may see: approved by moderation and owned by a seller in good standing. */
export const PUBLIC_LISTING_WHERE: Prisma.ListingWhereInput = {
  moderationStatus: 'APPROVED',
  seller: {
    accountStatus: 'ACTIVE'
  }
};

export const SELLER_SUMMARY_SELECT = {
  id: true,
  name: true,
  profilePicturePath: true,
  phoneVerifiedAt: true,
  identityVerifiedAt: true,
  trustedSellerAt: true,
  createdAt: true
} as const;

export const LISTING_CARD_INCLUDE = {
  images: {
    orderBy: [{ isCover: 'desc' as const }, { displayOrder: 'asc' as const }],
    take: 1
  },
  category: { select: { id: true, name: true, nameMy: true, slug: true } },
  subcategory: { select: { id: true, name: true, nameMy: true, slug: true } },
  city: { select: { id: true, name: true } },
  state: { select: { id: true, name: true } },
  seller: { select: SELLER_SUMMARY_SELECT }
} satisfies Prisma.ListingInclude;

export const LISTING_DETAIL_INCLUDE = {
  ...LISTING_CARD_INCLUDE,
  images: {
    orderBy: [{ isCover: 'desc' as const }, { displayOrder: 'asc' as const }]
  },
  movingOutSale: {
    select: { id: true, title: true, isActive: true }
  },
  review: {
    select: { id: true, rating: true, comment: true, reviewerUserId: true, createdAt: true }
  }
} satisfies Prisma.ListingInclude;

type SellerSummary = Prisma.UserGetPayload<{ select: typeof SELLER_SUMMARY_SELECT }>;

export type SellerBadge = 'PHONE_VERIFIED' | 'IDENTITY_VERIFIED' | 'TRUSTED_SELLER';

export const sellerBadges = (seller: Pick<SellerSummary, 'phoneVerifiedAt' | 'identityVerifiedAt' | 'trustedSellerAt'>) => {
  const badges: SellerBadge[] = [];
  if (seller.phoneVerifiedAt) badges.push('PHONE_VERIFIED');
  if (seller.identityVerifiedAt) badges.push('IDENTITY_VERIFIED');
  if (seller.trustedSellerAt) badges.push('TRUSTED_SELLER');
  return badges;
};

export type SellerRating = { average: number | null; count: number };

export const getSellerRatings = async (sellerIds: string[]): Promise<Map<string, SellerRating>> => {
  const uniqueIds = [...new Set(sellerIds)];
  const result = new Map<string, SellerRating>();
  if (uniqueIds.length === 0) {
    return result;
  }

  const grouped = await prisma.ratingReview.groupBy({
    by: ['targetUserId'],
    where: { targetType: 'SELLER', targetUserId: { in: uniqueIds } },
    _avg: { rating: true },
    _count: { _all: true }
  });

  for (const row of grouped) {
    result.set(row.targetUserId, {
      average: row._avg.rating == null ? null : Math.round(row._avg.rating * 10) / 10,
      count: row._count._all
    });
  }

  return result;
};

export const mapSellerSummary = (seller: SellerSummary, rating?: SellerRating) => ({
  id: seller.id,
  name: seller.name,
  profilePicturePath: seller.profilePicturePath,
  joinedAt: seller.createdAt,
  badges: sellerBadges(seller),
  rating: rating ?? { average: null, count: 0 }
});

const toImage = (image: { id: string; imagePath: string; optimizedPath: string | null; thumbnailPath: string | null; displayOrder: number; isCover: boolean }) => ({
  id: image.id,
  imagePath: image.imagePath,
  optimizedPath: image.optimizedPath ?? image.imagePath,
  thumbnailPath: image.thumbnailPath ?? image.optimizedPath ?? image.imagePath,
  displayOrder: image.displayOrder,
  isCover: image.isCover
});

export const mapListingCard = (
  listing: Prisma.ListingGetPayload<{ include: typeof LISTING_CARD_INCLUDE }>,
  ratings?: Map<string, SellerRating>
) => {
  const cover = listing.images[0];
  return {
    id: listing.id,
    title: listing.title,
    price: Number(listing.price),
    condition: listing.condition,
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    category: listing.category,
    subcategory: listing.subcategory,
    city: listing.city,
    state: listing.state,
    locationDetail: listing.locationDetail,
    thumbnail: cover ? toImage(cover).thumbnailPath : null,
    seller: mapSellerSummary(listing.seller, ratings?.get(listing.sellerId)),
    movingOutSaleId: listing.movingOutSaleId,
    publishedAt: listing.publishedAt,
    soldAt: listing.soldAt,
    createdAt: listing.createdAt
  };
};

export const mapListingDetail = (
  listing: Prisma.ListingGetPayload<{ include: typeof LISTING_DETAIL_INCLUDE }>,
  rating: SellerRating | undefined,
  availableContactMethods: ContactMethod[]
) => ({
  ...mapListingCard({ ...listing, images: listing.images.slice(0, 1) }, rating ? new Map([[listing.sellerId, rating]]) : undefined),
  description: listing.description,
  pickupMethod: listing.pickupMethod,
  images: listing.images.map(toImage),
  contactMethods: listing.status === 'SOLD' ? [] : availableContactMethods,
  showPhone: listing.showPhone,
  showTelegram: listing.showTelegram,
  showViber: listing.showViber,
  movingOutSale: listing.movingOutSale,
  review: listing.review
    ? { id: listing.review.id, rating: listing.review.rating, comment: listing.review.comment, createdAt: listing.review.createdAt }
    : null,
  updatedAt: listing.updatedAt
});

export const CONTACT_METHODS = ['phone', 'telegram', 'viber'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

type ContactSource = {
  showPhone: boolean;
  showTelegram: boolean;
  showViber: boolean;
};

type SellerContactValues = {
  phone: string | null;
  telegramUsername: string | null;
  viberNumber: string | null;
  showPhone: boolean;
  showTelegram: boolean;
  showViber: boolean;
} | null;

/** Resolves the seller's contact values, falling back to the account phone number. */
export const resolveSellerContactValues = (contact: SellerContactValues, accountPhone: string) => ({
  phone: contact?.showPhone === false ? null : contact?.phone?.trim() || accountPhone,
  telegram: contact?.showTelegram === false ? null : contact?.telegramUsername?.trim() || null,
  viber: contact?.showViber === false ? null : contact?.viberNumber?.trim() || null
});

export const availableContactMethods = (
  listing: ContactSource,
  values: ReturnType<typeof resolveSellerContactValues>
): ContactMethod[] => {
  const methods: ContactMethod[] = [];
  if (listing.showPhone && values.phone) methods.push('phone');
  if (listing.showTelegram && values.telegram) methods.push('telegram');
  if (listing.showViber && values.viber) methods.push('viber');
  return methods;
};

export const buildContactLink = (method: ContactMethod, value: string): string => {
  if (method === 'telegram') {
    return `https://t.me/${value.replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '')}`;
  }

  const digits = value.replace(/[^\d+]/g, '');
  if (method === 'viber') {
    const international = digits.startsWith('+') ? digits : digits.startsWith('09') ? `+95${digits.slice(1)}` : digits;
    return `viber://chat?number=${encodeURIComponent(international)}`;
  }

  return `tel:${digits}`;
};

/**
 * Keyword list for automatic moderation. A hit does not block or hide the listing;
 * it is published and admins are notified so they can review it.
 */
const PROHIBITED_KEYWORDS_EN = [
  'gun',
  'guns',
  'pistol',
  'rifle',
  'firearm',
  'ammunition',
  'ammo',
  'bullet',
  'bullets',
  'grenade',
  'explosive',
  'explosives',
  'weapon',
  'weapons',
  'drug',
  'drugs',
  'heroin',
  'cocaine',
  'methamphetamine',
  'meth',
  'yaba',
  'opium',
  'cannabis',
  'marijuana',
  'weed',
  'kratom',
  'counterfeit',
  'fake passport',
  'fake id',
  'stolen',
  'ivory',
  'wildlife',
  'endangered',
  'prescription',
  'narcotic',
  'narcotics',
  'poison'
];

const PROHIBITED_KEYWORDS_MY = ['သေနတ်', 'ကျည်ဆံ', 'ဗုံး', 'မူးယစ်ဆေး', 'ဘိန်း', 'ယာဘ', 'စိတ်ကြွဆေး', 'ဆင်စွယ်'];

export const findProhibitedKeywords = (...texts: Array<string | null | undefined>): string[] => {
  const haystack = texts.filter(Boolean).join(' \n ').toLowerCase();
  const hits = new Set<string>();

  for (const keyword of PROHIBITED_KEYWORDS_EN) {
    const pattern = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(haystack)) {
      hits.add(keyword);
    }
  }

  for (const keyword of PROHIBITED_KEYWORDS_MY) {
    if (haystack.includes(keyword)) {
      hits.add(keyword);
    }
  }

  return [...hits];
};

/** Common alternate names so searches also surface related item types. */
const SEARCH_SYNONYM_GROUPS = [
  ['fridge', 'refrigerator'],
  ['tv', 'television'],
  ['couch', 'sofa'],
  ['cupboard', 'wardrobe', 'closet'],
  ['notebook', 'laptop'],
  ['bookcase', 'bookshelf', 'shelf'],
  ['cooker', 'rice cooker'],
  ['table', 'desk'],
  ['mattress', 'bed'],
  ['luggage', 'suitcase', 'travel bag'],
  ['washer', 'washing machine'],
  ['lamp', 'light', 'lighting']
];

export const expandSearchToken = (token: string): string[] => {
  const lower = token.toLowerCase();
  const group = SEARCH_SYNONYM_GROUPS.find((words) => words.includes(lower));
  return group ? [...new Set([lower, ...group])] : [lower];
};

export const buildKeywordWhere = (q: string | undefined): Prisma.ListingWhereInput | undefined => {
  const tokens = (q ?? '')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .slice(0, 6);

  if (tokens.length === 0) {
    return undefined;
  }

  const insensitive = (value: string) => ({ contains: value, mode: 'insensitive' as const });

  return {
    AND: tokens.map((token) => ({
      OR: expandSearchToken(token).flatMap((term) => [
        { title: insensitive(term) },
        { description: insensitive(term) },
        { locationDetail: insensitive(term) },
        { category: { name: insensitive(term) } },
        { subcategory: { name: insensitive(term) } },
        { city: { name: insensitive(term) } },
        { state: { name: insensitive(term) } }
      ])
    }))
  };
};

export const paginated = <T>(items: T[], page: number, pageSize: number, total: number) => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize))
});

export const requireActiveMarketplaceUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      accountStatus: true,
      phoneVerifiedAt: true,
      identityVerifiedAt: true,
      trustedSellerAt: true
    }
  });

  if (!user) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'User account was not found.');
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new ApiError(403, 'MARKETPLACE_ACCOUNT_RESTRICTED', 'Your account is restricted from marketplace activity.');
  }

  return user;
};
