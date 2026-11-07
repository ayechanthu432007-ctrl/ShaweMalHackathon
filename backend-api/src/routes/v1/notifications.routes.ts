import { Router } from 'express';

import {
  getNotificationPreferencesController,
  listNotificationsController,
  markNotificationReadController,
  updateNotificationPreferencesController
} from '../../controllers/notification.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { notificationIdParamValidator, notificationPreferencesValidator } from '../../validators/notification.validator';

const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get('/', asyncHandler(listNotificationsController));
notificationsRouter.get('/preferences', asyncHandler(getNotificationPreferencesController));
notificationsRouter.put('/preferences', notificationPreferencesValidator, validateMiddleware, asyncHandler(updateNotificationPreferencesController));
notificationsRouter.patch('/:id/read', notificationIdParamValidator, validateMiddleware, asyncHandler(markNotificationReadController));

export { notificationsRouter };
