import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { toMyReview } from './review.service';
import { toSafeUser } from './user.service';

interface UpdateProfileInput {
  name?: string;
  phone?: string;
  profilePicturePath?: string | null;
}

const PROFILE_USER_INCLUDE = {
  userRoles: {
    include: {
      role: true
    }
  },
  agentProfile: {
    select: {
      verificationStatus: true
    }
  },
  driverProfile: {
    select: {
      verificationStatus: true
    }
  }
} as const;

const toSafeProfile = (user: {
  id: string;
  name: string;
  email: string;
  phone: string;
  profilePicturePath: string | null;
  userRoles: Array<{ role: { name: string } }>;
  agentProfile?: { verificationStatus: string } | null;
  driverProfile?: { verificationStatus: string } | null;
}) => ({
  ...toSafeUser(user),
  profilePicturePath: user.profilePicturePath
});

export const getMyProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: PROFILE_USER_INCLUDE
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return toSafeProfile(user);
};

export const updateMyProfile = async (userId: string, input: UpdateProfileInput) => {
  const data: {
    name?: string;
    phone?: string;
    profilePicturePath?: string | null;
  } = {};

  if (typeof input.name === 'string') {
    data.name = input.name;
  }

  if (typeof input.phone === 'string') {
    data.phone = input.phone;
  }

  if (input.profilePicturePath !== undefined) {
    data.profilePicturePath = input.profilePicturePath;
  }

  const user = await prisma.user.update({
    where: {
      id: userId
    },
    data,
    include: PROFILE_USER_INCLUDE
  });

  return toSafeProfile(user);
};

export const getMyProfileHistory = async (userId: string) => {
  const [
    bookingHistory,
    movingHistory,
    unreadNotificationCount,
    totalNotificationCount,
    recentNotifications,
    savedMarketplaceItems,
    marketplaceInquiries,
    marketplaceListings
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId
      },
      include: {
        house: {
          select: {
            id: true,
            title: true,
            availability: true,
            agentId: true,
            city: {
              select: {
                id: true,
                name: true
              }
            },
            state: {
              select: {
                id: true,
                name: true
              }
            },
            agent: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        ratingReview: {
          select: {
            id: true,
            rating: true,
            comment: true,
            reviewerUserId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.movingRequest.findMany({
      where: {
        requesterUserId: userId
      },
      include: {
        vehicleType: {
          select: {
            id: true,
            name: true
          }
        },
        assignedDriver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        ratingReview: {
          select: {
            id: true,
            rating: true,
            comment: true,
            reviewerUserId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    }),
    prisma.notification.count({
      where: {
        userId
      }
    }),
    prisma.notification.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    }),
    prisma.wishlist.findMany({
      where: { userId, listingId: { not: null } },
      include: { listing: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.listingInquiry.findMany({
      where: { buyerId: userId },
      include: { listing: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.listing.findMany({
      where: { sellerId: userId },
      select: { id: true, title: true, status: true, moderationStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  const marketplaceHistory = [
    ...savedMarketplaceItems.flatMap((item) => item.listing ? [{
      id: `saved-${item.id}`,
      listingId: item.listing.id,
      title: item.listing.title,
      action: 'SAVED' as const,
      createdAt: item.createdAt
    }] : []),
    ...marketplaceInquiries.map((inquiry) => ({
      id: `inquiry-${inquiry.id}`,
      listingId: inquiry.listing.id,
      title: inquiry.listing.title,
      action: 'INQUIRY' as const,
      status: inquiry.status,
      createdAt: inquiry.createdAt
    })),
    ...marketplaceListings.map((listing) => ({
      id: `listing-${listing.id}`,
      listingId: listing.id,
      title: listing.title,
      action: 'LISTED' as const,
      status: listing.moderationStatus === 'APPROVED' ? listing.status : listing.moderationStatus,
      createdAt: listing.createdAt
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);

  return {
    bookingHistory: bookingHistory.map((booking) => {
      const { ratingReview, ...rest } = booking;
      return {
        ...rest,
        myReview: toMyReview(ratingReview, userId)
      };
    }),
    movingHistory: movingHistory.map((item) => {
      const { ratingReview, ...rest } = item;
      return {
        ...rest,
        myReview: toMyReview(ratingReview, userId)
      };
    }),
    marketplaceHistory,
    notifications: {
      total: totalNotificationCount,
      unread: unreadNotificationCount,
      recent: recentNotifications
    }
  };
};
