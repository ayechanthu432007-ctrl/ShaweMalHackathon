import { Request, Response } from 'express';

import {
  getMyNotificationPreferences,
  listMyNotifications,
  markNotificationAsRead,
  updateMyNotificationPreferences
} from '../services/notification.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

export const listNotificationsController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);

  const payload = await listMyNotifications(userId);
  sendSuccess(res, 200, 'Notifications fetched successfully', payload);
};

export const markNotificationReadController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const notificationId = String(req.params.id ?? '');

  const item = await markNotificationAsRead(userId, notificationId);
  sendSuccess(res, 200, 'Notification marked as read', { item });
};

export const getNotificationPreferencesController = async (req: Request, res: Response): Promise<void> => {
  const preferences = await getMyNotificationPreferences(requireActor(req));
  sendSuccess(res, 200, 'Notification preferences fetched successfully', { preferences });
};

export const updateNotificationPreferencesController = async (req: Request, res: Response): Promise<void> => {
  const preferences = await updateMyNotificationPreferences(requireActor(req), {
    bookingUpdates: req.body.bookingUpdates,
    listingUpdates: req.body.listingUpdates
  });
  sendSuccess(res, 200, 'Notification preferences saved successfully', { preferences });
};
