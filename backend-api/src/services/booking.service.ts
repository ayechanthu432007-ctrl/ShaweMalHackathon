import { BookingStatus, CancelledByRole, HouseAvailabilityStatus, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { createNotificationIfEnabled } from './notification.service';
import { toMyReview } from './review.service';

interface CreateBookingInput {
  userId: string;
  houseId: string;
}

interface UpdateBookingStatusInput {
  bookingId: string;
  actorUserId: string;
  actorRoles: string[];
  status: 'CONFIRMED' | 'CANCELLED';
}

interface AdminBookingReportOptions {
  from?: Date;
  to?: Date;
  status?: BookingStatus;
  houseId?: string;
  agentId?: string;
  userId?: string;
}

const BOOKING_DETAIL_INCLUDE = {
  house: {
    select: {
      id: true,
      title: true,
      monthlyFees: true,
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
          name: true,
          email: true,
          phone: true
        }
      }
    }
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  cancelledByUser: {
    select: {
      id: true,
      name: true
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
} as const;

type BookingWithDetails = Prisma.BookingGetPayload<{ include: typeof BOOKING_DETAIL_INCLUDE }>;

const mapBooking = (booking: BookingWithDetails, actorUserId?: string) => {
  const { ratingReview, ...rest } = booking;

  return {
    ...rest,
    myReview: actorUserId ? toMyReview(ratingReview, actorUserId) : null
  };
};

const resolveCancelledByRole = (input: {
  isOwner: boolean;
  isAgentOwner: boolean;
  isAdmin: boolean;
}): CancelledByRole => {
  if (input.isAgentOwner) {
    return CancelledByRole.AGENT;
  }

  if (input.isOwner) {
    return CancelledByRole.USER;
  }

  return CancelledByRole.ADMIN;
};

export const createBooking = async (input: CreateBookingInput) => {
  const house = await prisma.house.findUnique({
    where: { id: input.houseId },
    select: {
      id: true,
      title: true,
      availability: true,
      agentId: true
    }
  });

  if (!house) {
    throw new ApiError(404, 'HOUSE_NOT_FOUND', 'House not found.');
  }

  if (house.availability !== HouseAvailabilityStatus.AVAILABLE) {
    throw new ApiError(400, 'HOUSE_NOT_AVAILABLE', 'House is not available for booking.');
  }

  const existing = await prisma.booking.findFirst({
    where: {
      userId: input.userId,
      houseId: input.houseId,
      status: {
        not: BookingStatus.CANCELLED
      }
    }
  });

  if (existing) {
    throw new ApiError(409, 'BOOKING_ALREADY_EXISTS', 'You already have an active booking for this house.');
  }

  const booking = await prisma.booking.create({
    data: {
      userId: input.userId,
      houseId: input.houseId,
      status: BookingStatus.CONFIRMED
    }
  });

  await createNotificationIfEnabled('BOOKING', {
      userId: input.userId,
      title: 'Booking Confirmation',
      message: `Thank you. Your booking for "${house.title}" is confirmed. The agent will contact you soon.`
  });

  if (house.agentId && house.agentId !== input.userId) {
    await createNotificationIfEnabled('BOOKING', {
        userId: house.agentId,
        title: 'New House Booking',
        message: `A user booked your house "${house.title}".`
    });
  }

  return booking;
};

export const getBookingById = async (bookingId: string, actorUserId: string, actorRoles: string[]) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_DETAIL_INCLUDE
  });

  if (!booking) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  const isOwner = booking.userId === actorUserId;
  const isAgentOwner = booking.house.agentId === actorUserId;
  const isAdmin = actorRoles.includes('admin');

  if (!isOwner && !isAgentOwner && !isAdmin) {
    throw new ApiError(403, 'BOOKING_FORBIDDEN', 'You are not allowed to view this booking.');
  }

  return mapBooking(booking, actorUserId);
};

export const updateBookingStatus = async (input: UpdateBookingStatusInput) => {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      house: {
        select: {
          id: true,
          title: true,
          agentId: true
        }
      },
      user: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!booking) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  const isOwner = booking.userId === input.actorUserId;
  const isAgentOwner = booking.house.agentId === input.actorUserId;
  const isAdmin = input.actorRoles.includes('admin');

  if (!isOwner && !isAgentOwner && !isAdmin) {
    throw new ApiError(403, 'BOOKING_FORBIDDEN', 'You are not allowed to update this booking.');
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new ApiError(400, 'BOOKING_ALREADY_CANCELLED', 'Booking is already cancelled.');
  }

  if (input.status === BookingStatus.CONFIRMED) {
    if (booking.status !== BookingStatus.PENDING) {
      throw new ApiError(400, 'BOOKING_INVALID_TRANSITION', 'Only pending bookings can be confirmed.');
    }

    const updated = await prisma.booking.update({
      where: { id: input.bookingId },
      data: {
        status: BookingStatus.CONFIRMED
      },
      include: BOOKING_DETAIL_INCLUDE
    });

    await createNotificationIfEnabled('BOOKING', {
        userId: booking.userId,
        title: 'Booking Confirmed',
        message: `Your booking for "${booking.house.title}" has been confirmed.`
    });

    return mapBooking(updated, input.actorUserId);
  }

  const cancelledByRole = resolveCancelledByRole({ isOwner, isAgentOwner, isAdmin });

  const updated = await prisma.booking.update({
    where: { id: input.bookingId },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledByUserId: input.actorUserId,
      cancelledByRole
    },
    include: BOOKING_DETAIL_INCLUDE
  });

  await createNotificationIfEnabled('BOOKING', {
      userId: booking.userId,
      title: 'Booking Cancelled',
      message: `Your booking for "${booking.house.title}" has been cancelled.`
  });

  if (cancelledByRole === CancelledByRole.USER && booking.house.agentId !== booking.userId) {
    await createNotificationIfEnabled('BOOKING', {
        userId: booking.house.agentId,
        title: 'Booking Cancelled',
        message: `A booking for "${booking.house.title}" was cancelled by the booking user.`
    });
  }

  return mapBooking(updated, input.actorUserId);
};

export const listUserBookings = async (userId: string) => {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: BOOKING_DETAIL_INCLUDE,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return bookings.map((booking) => mapBooking(booking, userId));
};

export const listAgentBookings = async (agentUserId: string) => {
  const bookings = await prisma.booking.findMany({
    where: {
      house: {
        agentId: agentUserId
      }
    },
    include: BOOKING_DETAIL_INCLUDE,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return bookings.map((booking) => mapBooking(booking));
};

export const listAdminBookings = async (options: AdminBookingReportOptions = {}) => {
  const where: {
    createdAt?: { gte?: Date; lte?: Date };
    status?: BookingStatus;
    houseId?: string;
    userId?: string;
    house?: { agentId: string };
  } = {};

  if (options.from || options.to) {
    where.createdAt = {
      gte: options.from,
      lte: options.to
    };
  }

  if (options.status) {
    where.status = options.status;
  }

  if (options.houseId) {
    where.houseId = options.houseId;
  }

  if (options.userId) {
    where.userId = options.userId;
  }

  if (options.agentId) {
    where.house = {
      agentId: options.agentId
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: BOOKING_DETAIL_INCLUDE,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return bookings.map((booking) => mapBooking(booking));
};
