import { body, query } from 'express-validator';

const reviewTargetTypes = ['AGENT', 'DRIVER', 'agent', 'driver'];

const optionalId = (field: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .withMessage(`${field} must be a string.`)
    .trim()
    .notEmpty()
    .withMessage(`${field} must not be empty.`);

export const createReviewValidator = [
  body().custom((_, { req }) => {
    const bookingId = typeof req.body.bookingId === 'string' ? req.body.bookingId.trim() : '';
    const movingRequestId = typeof req.body.movingRequestId === 'string' ? req.body.movingRequestId.trim() : '';

    if (Boolean(bookingId) === Boolean(movingRequestId)) {
      throw new Error('Provide exactly one of bookingId or movingRequestId.');
    }

    return true;
  }),
  optionalId('bookingId'),
  optionalId('movingRequestId'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be an integer from 1 to 5.'),
  body('comment')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('comment must be a string.')
    .isLength({ max: 1000 })
    .withMessage('comment must be at most 1000 characters.')
];

export const listReviewsValidator = [
  query('targetType').isIn(reviewTargetTypes).withMessage('targetType must be AGENT or DRIVER.'),
  query('targetUserId').trim().notEmpty().withMessage('targetUserId is required.')
];

export const reviewSummaryValidator = [
  query('targetType').isIn(reviewTargetTypes).withMessage('targetType must be AGENT or DRIVER.'),
  query('targetUserId')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('targetUserId must be a string.')
    .trim()
    .notEmpty()
    .withMessage('targetUserId must not be empty.')
];
