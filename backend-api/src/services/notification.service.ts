import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';

export type NotificationPreferenceCategory = 'BOOKING' | 'LISTING';

export const getMyNotificationPreferences = async (userId: string) =>
  prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {}
  });

export const updateMyNotificationPreferences = async (
  userId: string,
  preferences: { bookingUpdates?: boolean; listingUpdates?: boolean }
) => prisma.notificationPreference.upsert({
  where: { userId },
  create: { userId, ...preferences },
  update: preferences
});

export const createNotificationIfEnabled = async (
  category: NotificationPreferenceCategory,
  data: { userId: string; title: string; message: string }
) => {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: data.userId },
    select: { bookingUpdates: true, listingUpdates: true }
  });

  const enabled = category === 'BOOKING'
    ? preference?.bookingUpdates !== false
    : preference?.listingUpdates !== false;

  if (!enabled) return null;
  return prisma.notification.create({ data });
};

export const listMyNotifications = async (userId: string) => {
  const items = await prisma.notification.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  });

  return {
    items,
    unreadCount
  };
};

export const markNotificationAsRead = async (userId: string, notificationId: string) => {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      isRead: true
    }
  });

  if (result.count === 0) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  const item = await prisma.notification.findUnique({
    where: {
      id: notificationId
    }
  });

  if (!item) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  return item;
};
