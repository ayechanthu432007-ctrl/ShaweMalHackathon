import { BookingStatus, MovingRequestStatus, Prisma, ReviewTargetType } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';

export type MyReviewSummary = {
  id: string;
  rating: number;
  comment: string | null;
};

interface CreateReviewInput {
  reviewerUserId: string;
  rating: number;
  comment?: string;
  bookingId?: string;
  movingRequestId?: string;
}

interface ListReviewsInput {
  targetType: ReviewTargetType;
  targetUserId: string;
}

const reviewerInclude = {
  reviewer: {
    select: {
      id: true,
      name: true,
      profilePicturePath: true
    }
  }
} as const;

const mapReview = (
  item: Prisma.RatingReviewGetPayload<{
    include: typeof reviewerInclude;
  }>
) => ({
  id: item.id,
  targetType: item.targetType,
  targetUserId: item.targetUserId,
  rating: item.rating,
  comment: item.comment,
  bookingId: item.bookingId,
  movingRequestId: item.movingRequestId,
  reviewer: item.reviewer,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export const toMyReview = (
  review: { id: string; rating: number; comment: string | null; reviewerUserId: string } | null | undefined,
  actorUserId: string
): MyReviewSummary | null => {
  if (!review || review.reviewerUserId !== actorUserId) {
    return null;
  }

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment
  };
};

const normalizeComment = (comment?: string): string | null => {
  if (typeof comment !== 'string') {
    return null;
  }

  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureTargetUserValidForType = async (targetType: ReviewTargetType, targetUserId: string): Promise<void> => {
  const targetUser = await prisma.user.findUnique({
    where: {
      id: targetUserId
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!targetUser) {
    throw new ApiError(404, 'REVIEW_TARGET_NOT_FOUND', 'Review target user not found.');
  }

  const expectedRole = targetType === 'AGENT' ? 'agent' : 'driver';
  const hasExpectedRole = targetUser.userRoles.some((item) => item.role.name === expectedRole);

  if (!hasExpectedRole) {
    throw new ApiError(400, 'REVIEW_TARGET_ROLE_MISMATCH', `Target user is not a ${expectedRole}.`);
  }
};

const resolveAgentReviewSource = async (reviewerUserId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      house: {
        select: {
          agentId: true
        }
      }
    }
  });

  if (!booking) {
    throw new ApiError(404, 'REVIEW_BOOKING_NOT_FOUND', 'Booking not found.');
  }

  if (booking.userId !== reviewerUserId) {
    throw new ApiError(403, 'REVIEW_NOT_OWNER', 'You can only rate bookings that belong to you.');
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new ApiError(400, 'REVIEW_BOOKING_NOT_ELIGIBLE', 'You can only rate the agent after a confirmed booking.');
  }

  return {
    targetType: ReviewTargetType.AGENT,
    targetUserId: booking.house.agentId,
    bookingId: booking.id,
    movingRequestId: null as string | null
  };
};

const resolveDriverReviewSource = async (reviewerUserId: string, movingRequestId: string) => {
  const movingRequest = await prisma.movingRequest.findUnique({
    where: { id: movingRequestId },
    select: {
      id: true,
      requesterUserId: true,
      assignedDriverUserId: true,
      status: true
    }
  });

  if (!movingRequest) {
    throw new ApiError(404, 'REVIEW_MOVE_NOT_FOUND', 'Moving request not found.');
  }

  if (movingRequest.requesterUserId !== reviewerUserId) {
    throw new ApiError(403, 'REVIEW_NOT_OWNER', 'You can only rate moving requests that belong to you.');
  }

  if (movingRequest.status !== MovingRequestStatus.COMPLETED) {
    throw new ApiError(400, 'REVIEW_MOVE_NOT_ELIGIBLE', 'You can only rate the driver after the move is completed.');
  }

  if (!movingRequest.assignedDriverUserId) {
    throw new ApiError(400, 'REVIEW_DRIVER_NOT_ASSIGNED', 'This move has no assigned driver to rate.');
  }

  return {
    targetType: ReviewTargetType.DRIVER,
    targetUserId: movingRequest.assignedDriverUserId,
    bookingId: null as string | null,
    movingRequestId: movingRequest.id
  };
};

export const createReview = async (input: CreateReviewInput) => {
  const bookingId = input.bookingId?.trim() || undefined;
  const movingRequestId = input.movingRequestId?.trim() || undefined;

  if (Boolean(bookingId) === Boolean(movingRequestId)) {
    throw new ApiError(400, 'REVIEW_SOURCE_REQUIRED', 'Provide exactly one of bookingId or movingRequestId.');
  }

  const source = bookingId
    ? await resolveAgentReviewSource(input.reviewerUserId, bookingId)
    : await resolveDriverReviewSource(input.reviewerUserId, movingRequestId as string);

  if (input.reviewerUserId === source.targetUserId) {
    throw new ApiError(400, 'REVIEW_SELF_NOT_ALLOWED', 'You cannot rate or review yourself.');
  }

  await ensureTargetUserValidForType(source.targetType, source.targetUserId);

  const existing = source.bookingId
    ? await prisma.ratingReview.findUnique({
        where: { bookingId: source.bookingId },
        include: reviewerInclude
      })
    : await prisma.ratingReview.findUnique({
        where: { movingRequestId: source.movingRequestId as string },
        include: reviewerInclude
      });

  const comment = normalizeComment(input.comment);

  if (existing) {
    if (existing.reviewerUserId !== input.reviewerUserId) {
      throw new ApiError(403, 'REVIEW_NOT_OWNER', 'You cannot update this review.');
    }

    const updated = await prisma.ratingReview.update({
      where: { id: existing.id },
      data: {
        rating: input.rating,
        comment
      },
      include: reviewerInclude
    });

    return { item: mapReview(updated), created: false };
  }

  const created = await prisma.ratingReview.create({
    data: {
      reviewerUserId: input.reviewerUserId,
      targetType: source.targetType,
      targetUserId: source.targetUserId,
      rating: input.rating,
      comment,
      bookingId: source.bookingId,
      movingRequestId: source.movingRequestId
    },
    include: reviewerInclude
  });

  return { item: mapReview(created), created: true };
};

export const listReviews = async (input: ListReviewsInput) => {
  const [items, stats] = await Promise.all([
    prisma.ratingReview.findMany({
      where: {
        targetType: input.targetType,
        targetUserId: input.targetUserId
      },
      include: reviewerInclude,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.ratingReview.aggregate({
      where: {
        targetType: input.targetType,
        targetUserId: input.targetUserId
      },
      _avg: {
        rating: true
      },
      _count: {
        _all: true
      }
    })
  ]);

  return {
    items: items.map(mapReview),
    summary: {
      averageRating: stats._avg.rating ?? 0,
      reviewCount: stats._count._all
    }
  };
};

export const getReviewSummary = async (input: { targetType: ReviewTargetType; targetUserId?: string }) => {
  const stats = await prisma.ratingReview.aggregate({
    where: {
      targetType: input.targetType,
      ...(input.targetUserId ? { targetUserId: input.targetUserId } : {})
    },
    _avg: { rating: true },
    _count: { _all: true }
  });

  return {
    summary: {
      averageRating: stats._avg.rating ?? 0,
      reviewCount: stats._count._all
    }
  };
};
