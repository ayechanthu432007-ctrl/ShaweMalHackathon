import { AccountStatus, ListingModerationStatus, ListingReportStatus, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { writeAuditLog } from './audit.service';
import {
  getSellerRatings,
  LISTING_CARD_INCLUDE,
  LISTING_DETAIL_INCLUDE,
  mapListingCard,
  mapListingDetail,
  paginated,
  sellerBadges
} from './marketplace-shared';
import { revokeAllUserSessions } from './session.service';

/** Platform-defined criteria for the Trusted Seller badge. */
export const TRUSTED_SELLER_CRITERIA = {
  minSoldListings: 3,
  minReviews: 2,
  minAverageRating: 4
} as const;

export const getMarketplaceOverview = async () => {
  const [totalListings, activeListings, soldItems, reportedListings, suspendedSellers, pendingReviews, openReports] =
    await Promise.all([
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'ACTIVE', moderationStatus: 'APPROVED' } }),
      prisma.listing.count({ where: { status: 'SOLD' } }),
      prisma.listing.count({ where: { reports: { some: { status: 'OPEN' } } } }),
      prisma.user.count({ where: { accountStatus: { in: ['SUSPENDED', 'BANNED'] } } }),
      prisma.listing.count({ where: { moderationStatus: 'PENDING' } }),
      prisma.listingReport.count({ where: { status: 'OPEN' } })
    ]);

  return { totalListings, activeListings, soldItems, reportedListings, suspendedSellers, pendingReviews, openReports };
};

export interface AdminListingsFilter {
  q?: string;
  status?: 'ACTIVE' | 'SOLD';
  moderationStatus?: ListingModerationStatus;
  reported?: boolean;
  sellerId?: string;
  page: number;
  pageSize: number;
}

export const adminListListings = async (filter: AdminListingsFilter) => {
  const where: Prisma.ListingWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.moderationStatus ? { moderationStatus: filter.moderationStatus } : {}),
    ...(filter.reported ? { reports: { some: { status: 'OPEN' } } } : {}),
    ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
    ...(filter.q
      ? {
          OR: [
            { title: { contains: filter.q, mode: 'insensitive' } },
            { seller: { name: { contains: filter.q, mode: 'insensitive' } } },
            { seller: { email: { contains: filter.q, mode: 'insensitive' } } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        ...LISTING_CARD_INCLUDE,
        seller: { select: { ...LISTING_CARD_INCLUDE.seller.select, accountStatus: true } },
        _count: { select: { reports: { where: { status: 'OPEN' } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize
    }),
    prisma.listing.count({ where })
  ]);

  return paginated(
    items.map((listing) => ({
      ...mapListingCard(listing),
      moderationNote: listing.moderationNote,
      sellerAccountStatus: listing.seller.accountStatus,
      openReportCount: listing._count.reports
    })),
    filter.page,
    filter.pageSize,
    total
  );
};

const REPORT_INCLUDE = {
  reporter: { select: { id: true, name: true, email: true } },
  reportedUser: { select: { id: true, name: true, email: true, accountStatus: true } },
  admin: { select: { id: true, name: true } },
  listing: { select: { id: true, title: true, moderationStatus: true, status: true } }
} as const;

const mapReport = (report: Prisma.ListingReportGetPayload<{ include: typeof REPORT_INCLUDE }>) => ({
  id: report.id,
  reason: report.reason,
  description: report.description,
  status: report.status,
  adminNote: report.adminNote,
  reporter: report.reporter,
  reportedUser: report.reportedUser,
  listing: report.listing,
  admin: report.admin,
  createdAt: report.createdAt,
  resolvedAt: report.resolvedAt
});

export const adminGetListing = async (listingId: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      ...LISTING_DETAIL_INCLUDE,
      seller: { select: { ...LISTING_CARD_INCLUDE.seller.select, email: true, phone: true, accountStatus: true } },
      reports: { include: REPORT_INCLUDE, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  const ratings = await getSellerRatings([listing.sellerId]);
  return {
    ...mapListingDetail(listing, ratings.get(listing.sellerId), []),
    moderationNote: listing.moderationNote,
    policyAcceptedAt: listing.policyAcceptedAt,
    sellerAccount: { email: listing.seller.email, phone: listing.seller.phone, accountStatus: listing.seller.accountStatus },
    reports: listing.reports.map(mapReport)
  };
};

export type ModerationAction = 'approve' | 'reject' | 'remove' | 'restore';

const MODERATION_TRANSITIONS: Record<ModerationAction, { to: ListingModerationStatus; from: ListingModerationStatus[] }> = {
  approve: { to: 'APPROVED', from: ['PENDING', 'REJECTED'] },
  reject: { to: 'REJECTED', from: ['PENDING', 'APPROVED'] },
  remove: { to: 'REMOVED', from: ['PENDING', 'APPROVED', 'REJECTED'] },
  restore: { to: 'APPROVED', from: ['REMOVED'] }
};

const MODERATION_MESSAGES: Record<ModerationAction, string> = {
  approve: 'is now live on the marketplace.',
  reject: 'was not approved. Please edit it to follow the marketplace policy.',
  remove: 'was removed for violating the marketplace policy.',
  restore: 'has been restored and is visible again.'
};

export const adminModerateListing = async (input: { actorUserId: string; listingId: string; action: ModerationAction; note?: string }) => {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, title: true, sellerId: true, moderationStatus: true, publishedAt: true }
  });

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  const transition = MODERATION_TRANSITIONS[input.action];
  if (!transition.from.includes(listing.moderationStatus)) {
    throw new ApiError(409, 'LISTING_MODERATION_INVALID', `Cannot ${input.action} a listing that is ${listing.moderationStatus}.`);
  }

  const note = input.note?.trim() || null;
  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      moderationStatus: transition.to,
      moderationNote: note,
      publishedAt: transition.to === 'APPROVED' ? (listing.publishedAt ?? new Date()) : listing.publishedAt
    }
  });

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: listing.sellerId,
        title: 'Marketplace listing update',
        message: `Your listing "${listing.title}" ${MODERATION_MESSAGES[input.action]}${note ? ` Note: ${note}` : ''}`
      }
    }),
    writeAuditLog({
      actorUserId: input.actorUserId,
      action: `MARKETPLACE_LISTING_${input.action.toUpperCase()}`,
      targetType: 'Listing',
      targetId: listing.id,
      metadata: { from: listing.moderationStatus, to: transition.to, note }
    })
  ]);

  return { id: updated.id, moderationStatus: updated.moderationStatus };
};

export const adminUpdateListingCategory = async (input: {
  actorUserId: string;
  listingId: string;
  categoryId: string;
  subcategoryId?: string | null;
}) => {
  const [listing, category] = await Promise.all([
    prisma.listing.findUnique({ where: { id: input.listingId }, select: { id: true, categoryId: true, subcategoryId: true } }),
    prisma.marketplaceCategory.findFirst({
      where: { id: input.categoryId, parentId: null },
      include: { children: { select: { id: true } } }
    })
  ]);

  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  if (!category) {
    throw new ApiError(400, 'LISTING_CATEGORY_INVALID', 'Choose a category from the list.');
  }

  const subcategoryId = input.subcategoryId ?? null;
  if (subcategoryId && !category.children.some((child) => child.id === subcategoryId)) {
    throw new ApiError(400, 'LISTING_SUBCATEGORY_INVALID', 'Subcategory does not belong to the selected category.');
  }

  if (!subcategoryId && category.children.length > 0) {
    throw new ApiError(400, 'LISTING_SUBCATEGORY_REQUIRED', 'Choose a subcategory for this category.');
  }

  await prisma.listing.update({ where: { id: listing.id }, data: { categoryId: category.id, subcategoryId } });
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: 'MARKETPLACE_LISTING_CATEGORY_CHANGED',
    targetType: 'Listing',
    targetId: listing.id,
    metadata: {
      from: { categoryId: listing.categoryId, subcategoryId: listing.subcategoryId },
      to: { categoryId: category.id, subcategoryId }
    }
  });

  return { id: listing.id, categoryId: category.id, subcategoryId };
};

export const adminListReports = async (filter: { status?: ListingReportStatus; page: number; pageSize: number }) => {
  const where: Prisma.ListingReportWhereInput = filter.status ? { status: filter.status } : {};
  const [items, total] = await Promise.all([
    prisma.listingReport.findMany({
      where,
      include: REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize
    }),
    prisma.listingReport.count({ where })
  ]);

  return paginated(items.map(mapReport), filter.page, filter.pageSize, total);
};

export const adminResolveReport = async (input: {
  actorUserId: string;
  reportId: string;
  status: 'RESOLVED' | 'DISMISSED';
  adminNote?: string;
  removeListing?: boolean;
}) => {
  const report = await prisma.listingReport.findUnique({ where: { id: input.reportId }, include: REPORT_INCLUDE });
  if (!report) {
    throw new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  }

  if (report.status !== 'OPEN') {
    throw new ApiError(409, 'REPORT_ALREADY_CLOSED', 'This report has already been reviewed.');
  }

  const adminNote = input.adminNote?.trim() || null;

  if (input.removeListing && input.status === 'RESOLVED' && report.listing && report.listing.moderationStatus !== 'REMOVED') {
    await adminModerateListing({
      actorUserId: input.actorUserId,
      listingId: report.listing.id,
      action: 'remove',
      note: adminNote ?? `Removed after a report: ${report.reason}`
    });
  }

  const updated = await prisma.listingReport.update({
    where: { id: report.id },
    data: { status: input.status, adminNote, adminId: input.actorUserId, resolvedAt: new Date() },
    include: REPORT_INCLUDE
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: `MARKETPLACE_REPORT_${input.status}`,
    targetType: 'ListingReport',
    targetId: report.id,
    metadata: { removeListing: Boolean(input.removeListing), adminNote }
  });

  return mapReport(updated);
};

export const adminListMarketplaceUsers = async (filter: {
  q?: string;
  accountStatus?: AccountStatus;
  verification?: 'phone_unverified' | 'phone_verified' | 'identity_verified' | 'trusted';
  reported?: boolean;
  page: number;
  pageSize: number;
}) => {
  const verificationWhere: Record<string, Prisma.UserWhereInput> = {
    phone_unverified: { phoneVerifiedAt: null },
    phone_verified: { phoneVerifiedAt: { not: null } },
    identity_verified: { identityVerifiedAt: { not: null } },
    trusted: { trustedSellerAt: { not: null } }
  };

  const where: Prisma.UserWhereInput = {
    ...(filter.accountStatus ? { accountStatus: filter.accountStatus } : {}),
    ...(filter.verification ? verificationWhere[filter.verification] : {}),
    ...(filter.reported ? { listingReportsReceived: { some: { status: 'OPEN' } } } : {}),
    ...(filter.q
      ? {
          OR: [
            { name: { contains: filter.q, mode: 'insensitive' } },
            { email: { contains: filter.q, mode: 'insensitive' } },
            { phone: { contains: filter.q } }
          ]
        }
      : {})
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        accountStatus: true,
        phoneVerifiedAt: true,
        identityVerifiedAt: true,
        trustedSellerAt: true,
        createdAt: true,
        _count: {
          select: {
            listings: true,
            listingReportsReceived: { where: { status: 'OPEN' } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize
    }),
    prisma.user.count({ where })
  ]);

  return paginated(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      accountStatus: user.accountStatus,
      badges: sellerBadges(user),
      listingCount: user._count.listings,
      openReportCount: user._count.listingReportsReceived,
      createdAt: user.createdAt
    })),
    filter.page,
    filter.pageSize,
    total
  );
};

const evaluateTrustedSeller = async (userId: string, identityVerified: boolean) => {
  const [soldListings, ratings, upheldReports] = await Promise.all([
    prisma.listing.count({ where: { sellerId: userId, status: 'SOLD' } }),
    getSellerRatings([userId]),
    prisma.listingReport.count({ where: { reportedUserId: userId, status: 'RESOLVED' } })
  ]);

  const rating = ratings.get(userId) ?? { average: null, count: 0 };
  const checks = {
    identityVerified,
    completedTransactions: soldListings >= TRUSTED_SELLER_CRITERIA.minSoldListings,
    goodReviews: rating.count >= TRUSTED_SELLER_CRITERIA.minReviews && (rating.average ?? 0) >= TRUSTED_SELLER_CRITERIA.minAverageRating,
    noSeriousReports: upheldReports === 0
  };

  return {
    criteria: TRUSTED_SELLER_CRITERIA,
    soldListings,
    rating,
    upheldReports,
    checks,
    eligible: Object.values(checks).every(Boolean)
  };
};

export const adminGetMarketplaceUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profilePicturePath: true,
      accountStatus: true,
      phoneVerifiedAt: true,
      identityVerifiedAt: true,
      trustedSellerAt: true,
      createdAt: true,
      sellerContact: true
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const [listings, reportsReceived, trusted] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: userId },
      include: LISTING_CARD_INCLUDE,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.listingReport.findMany({
      where: { reportedUserId: userId },
      include: REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' }
    }),
    evaluateTrustedSeller(userId, Boolean(user.identityVerifiedAt))
  ]);

  return {
    ...user,
    badges: sellerBadges(user),
    trustedSellerEvaluation: trusted,
    listingHistory: listings.map((listing) => ({ ...mapListingCard(listing), moderationNote: listing.moderationNote })),
    reportsReceived: reportsReceived.map(mapReport)
  };
};

const ACCOUNT_STATUS_MESSAGES: Record<AccountStatus, string> = {
  ACTIVE: 'Your account has been reactivated.',
  SUSPENDED: 'Your account has been suspended. Your marketplace listings are hidden.',
  BANNED: 'Your account has been banned for violating Shawe Mal policies.'
};

export const adminUpdateAccountStatus = async (input: {
  actorUserId: string;
  userId: string;
  accountStatus: AccountStatus;
  reason?: string;
}) => {
  if (input.actorUserId === input.userId && input.accountStatus !== 'ACTIVE') {
    throw new ApiError(400, 'ACCOUNT_STATUS_SELF', 'You cannot suspend or ban your own account.');
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, accountStatus: true } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const reason = input.reason?.trim() || null;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      accountStatus: input.accountStatus,
      // A restricted account loses Trusted Seller status.
      ...(input.accountStatus !== 'ACTIVE' ? { trustedSellerAt: null } : {})
    }
  });

  if (input.accountStatus !== 'ACTIVE') {
    await revokeAllUserSessions(user.id);
  }

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Account status update',
        message: `${ACCOUNT_STATUS_MESSAGES[input.accountStatus]}${reason ? ` Reason: ${reason}` : ''}`
      }
    }),
    writeAuditLog({
      actorUserId: input.actorUserId,
      action: `ACCOUNT_STATUS_${input.accountStatus}`,
      targetType: 'User',
      targetId: user.id,
      metadata: { from: user.accountStatus, to: input.accountStatus, reason }
    })
  ]);

  return adminGetMarketplaceUser(user.id);
};

export const adminUpdateSellerVerification = async (input: {
  actorUserId: string;
  userId: string;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  trustedSeller?: boolean;
}) => {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, accountStatus: true, phoneVerifiedAt: true, identityVerifiedAt: true, trustedSellerAt: true }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const now = new Date();
  const data: Prisma.UserUpdateInput = {};
  const toTimestamp = (flag: boolean, current: Date | null) => (flag ? (current ?? now) : null);

  if (typeof input.phoneVerified === 'boolean') {
    data.phoneVerifiedAt = toTimestamp(input.phoneVerified, user.phoneVerifiedAt);
  }

  const identityVerified =
    typeof input.identityVerified === 'boolean' ? input.identityVerified : Boolean(user.identityVerifiedAt);
  if (typeof input.identityVerified === 'boolean') {
    data.identityVerifiedAt = toTimestamp(input.identityVerified, user.identityVerifiedAt);
  }

  if (input.trustedSeller === true && !user.trustedSellerAt) {
    if (user.accountStatus !== 'ACTIVE') {
      throw new ApiError(400, 'TRUSTED_SELLER_NOT_ELIGIBLE', 'Restricted accounts cannot be Trusted Sellers.');
    }

    const evaluation = await evaluateTrustedSeller(user.id, identityVerified);
    if (!evaluation.eligible) {
      throw new ApiError(400, 'TRUSTED_SELLER_NOT_ELIGIBLE', 'This seller does not meet the Trusted Seller criteria yet.', evaluation);
    }
    data.trustedSellerAt = now;
  } else if (input.trustedSeller === false || (input.identityVerified === false && user.trustedSellerAt)) {
    // Trusted Seller requires a verified identity, so revoking identity revokes the badge too.
    data.trustedSellerAt = null;
  }

  await prisma.user.update({ where: { id: user.id }, data });

  const granted: string[] = [];
  if (input.phoneVerified && !user.phoneVerifiedAt) granted.push('Phone Verified');
  if (input.identityVerified && !user.identityVerifiedAt) granted.push('Identity Verified');
  if (input.trustedSeller && !user.trustedSellerAt) granted.push('Trusted Seller');

  await Promise.all([
    granted.length > 0
      ? prisma.notification.create({
          data: {
            userId: user.id,
            title: 'Seller verification update',
            message: `You received the ${granted.join(', ')} badge${granted.length > 1 ? 's' : ''}.`
          }
        })
      : Promise.resolve(),
    writeAuditLog({
      actorUserId: input.actorUserId,
      action: 'MARKETPLACE_SELLER_VERIFICATION_UPDATED',
      targetType: 'User',
      targetId: user.id,
      metadata: {
        phoneVerified: input.phoneVerified ?? null,
        identityVerified: input.identityVerified ?? null,
        trustedSeller: input.trustedSeller ?? null
      }
    })
  ]);

  return adminGetMarketplaceUser(user.id);
};
