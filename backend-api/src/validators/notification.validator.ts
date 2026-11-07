import { body, param } from 'express-validator';

export const notificationIdParamValidator = [param('id').trim().notEmpty().withMessage('Notification id is required.')];

export const notificationPreferencesValidator = [
  body('bookingUpdates').optional().isBoolean().withMessage('Booking preference must be true or false.'),
  body('listingUpdates').optional().isBoolean().withMessage('Listing preference must be true or false.'),
  body().custom((value) => {
    if (typeof value?.bookingUpdates !== 'boolean' && typeof value?.listingUpdates !== 'boolean') {
      throw new Error('Choose at least one notification preference.');
    }
    return true;
  })
];
