import { body, param, query } from 'express-validator';

import { MARKETPLACE_MAX_PHOTOS } from '../utils/upload-path';

export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'] as const;
export const LISTING_PICKUP_METHODS = ['MEET_UP', 'SELLER_DELIVERY', 'BUYER_PICKUP', 'DISCUSS'] as const;
export const LISTING_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export const LISTING_REPORT_REASONS = [
  'SCAM',
  'WRONG_INFORMATION',
  'FAKE_ITEM',
  'PROHIBITED_ITEM',
  'DUPLICATE_LISTING',
  'OFFENSIVE_CONTENT',
  'INAPPROPRIATE_IMAGE',
  'WRONG_CATEGORY',
  'SUSPICIOUS_PAYMENT',
  'OTHER'
] as const;
export const RELOCATION_STATUSES = ['PLANNING', 'MOVING', 'SETTLED'] as const;

const MAX_PRICE = 9_999_999_999;

const idParam = (name: string) => param(name).trim().notEmpty().withMessage(`${name} is required.`);

const optionalNullableString = (field: string, max: number) =>
  body(field)
    .optional({ values: 'null' })
    .isString()
    .withMessage(`${field} must be a string.`)
    .isLength({ max })
    .withMessage(`${field} must be at most ${max} characters.`);

const optionalNullableDate = (field: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage(`${field} must be a valid date.`);

export const listingIdParamValidator = [idParam('id')];
export const sellerIdParamValidator = [idParam('sellerId')];

export const searchListingsValidator = [
  query('q').optional().isString().isLength({ max: 100 }).withMessage('q must be at most 100 characters.'),
  query('categoryId').optional().isString(),
  query('subcategoryId').optional().isString(),
  query('condition').optional().isIn(LISTING_CONDITIONS).withMessage('condition is invalid.'),
  query('stateId').optional().isString(),
  query('cityId').optional().isString(),
  query('sellerId').optional().isString(),
  query('movingOutSaleId').optional().isString(),
  query('status').optional().isIn(['ACTIVE', 'SOLD']).withMessage('status must be ACTIVE or SOLD.'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a non-negative number.'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a non-negative number.'),
  query('sort').optional().isIn(LISTING_SORTS).withMessage('sort must be newest, price_asc, or price_desc.'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('pageSize').optional().isInt({ min: 1, max: 48 }).withMessage('pageSize must be between 1 and 48.'),
  query().custom((_, { req }) => {
    const { minPrice, maxPrice } = req.query ?? {};
    if (minPrice === undefined || maxPrice === undefined || Number(minPrice) <= Number(maxPrice)) {
      return true;
    }
    throw new Error('minPrice must be less than or equal to maxPrice.');
  })
];

export const recommendationsValidator = [
  query('destinationCityId').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 24 }).withMessage('limit must be between 1 and 24.')
];

export const revealContactValidator = [
  idParam('id'),
  query('method').isIn(['phone', 'telegram', 'viber']).withMessage('method must be phone, telegram, or viber.')
];

export const listingBodyValidator = [
  body('title').isString().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3-120 characters.'),
  body('description').isString().trim().isLength({ min: 10, max: 4000 }).withMessage('Description must be 10-4000 characters.'),
  body('categoryId').isString().trim().notEmpty().withMessage('Category is required.'),
  body('subcategoryId').optional({ values: 'null' }).isString().withMessage('subcategoryId must be a string.'),
  body('price').isFloat({ min: 0, max: MAX_PRICE }).withMessage('Price must be a non-negative number.'),
  body('condition').isIn(LISTING_CONDITIONS).withMessage('Condition is required.'),
  body('cityId').isString().trim().notEmpty().withMessage('Township is required.'),
  optionalNullableString('locationDetail', 200),
  body('pickupMethod').isIn(LISTING_PICKUP_METHODS).withMessage('Pickup method is required.'),
  body('images')
    .isArray({ min: 1, max: MARKETPLACE_MAX_PHOTOS })
    .withMessage(`Add between 1 and ${MARKETPLACE_MAX_PHOTOS} photos.`),
  body('images.*').isString().withMessage('Each photo must be an uploaded path.'),
  body('coverIndex').optional().isInt({ min: 0 }).withMessage('coverIndex must be a non-negative integer.'),
  body('showPhone').isBoolean().withMessage('showPhone must be a boolean.'),
  body('showTelegram').isBoolean().withMessage('showTelegram must be a boolean.'),
  body('showViber').isBoolean().withMessage('showViber must be a boolean.'),
  body('movingOutSaleId').optional({ values: 'null' }).isString().withMessage('movingOutSaleId must be a string.'),
  body('policyAccepted').custom((value) => value === true).withMessage('You must accept the marketplace policy.')
];

export const updateListingStatusValidator = [
  idParam('id'),
  body('status').isIn(['ACTIVE', 'SOLD']).withMessage('status must be ACTIVE or SOLD.'),
  body('buyerId').optional({ values: 'null' }).isString().withMessage('buyerId must be a string.')
];

export const myListingsValidator = [query('status').optional().isIn(['ACTIVE', 'SOLD']).withMessage('status must be ACTIVE or SOLD.')];

export const sellerContactValidator = [
  optionalNullableString('phone', 30),
  optionalNullableString('telegramUsername', 64),
  optionalNullableString('viberNumber', 30),
  body('telegramUsername')
    .optional({ values: 'falsy' })
    .matches(/^@?[A-Za-z0-9_]{5,32}$/)
    .withMessage('Telegram username must be 5-32 letters, numbers, or underscores.'),
  body('phone').optional({ values: 'falsy' }).matches(/^\+?[\d\s-]{6,20}$/).withMessage('Phone number is invalid.'),
  body('viberNumber').optional({ values: 'falsy' }).matches(/^\+?[\d\s-]{6,20}$/).withMessage('Viber number is invalid.'),
  body('showPhone').isBoolean().withMessage('showPhone must be a boolean.'),
  body('showTelegram').isBoolean().withMessage('showTelegram must be a boolean.'),
  body('showViber').isBoolean().withMessage('showViber must be a boolean.')
];

export const createReportValidator = [
  body('listingId').optional({ values: 'falsy' }).isString(),
  body('reportedUserId').optional({ values: 'falsy' }).isString(),
  body().custom((_, { req }) => {
    if (!req.body?.listingId && !req.body?.reportedUserId) {
      throw new Error('Provide listingId or reportedUserId.');
    }
    return true;
  }),
  body('reason').isIn(LISTING_REPORT_REASONS).withMessage('Choose a report reason.'),
  body('description')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Details must be at most 1000 characters.'),
  body('description').custom((value, { req }) => {
    if (req.body?.reason === 'OTHER' && !(typeof value === 'string' && value.trim())) {
      throw new Error('Please describe the problem.');
    }
    return true;
  })
];

export const createSellerReviewValidator = [
  idParam('id'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be an integer from 1 to 5.'),
  body('comment').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }).withMessage('comment must be at most 1000 characters.')
];

export const movingOutSaleBodyValidator = [
  body('title').isString().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3-120 characters.'),
  optionalNullableString('description', 1000),
  body('originCityId').isString().trim().notEmpty().withMessage('Moving-from township is required.'),
  body('destinationCityId').optional({ values: 'null' }).isString(),
  optionalNullableDate('moveOutDate'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.')
];

export const movingOutSaleIdParamValidator = [idParam('saleId')];

export const relocationBodyValidator = [
  body('originCityId').optional({ values: 'null' }).isString(),
  body('destinationCityId').isString().trim().notEmpty().withMessage('Destination township is required.'),
  optionalNullableDate('moveDate'),
  body('status').optional().isIn(RELOCATION_STATUSES).withMessage('status is invalid.')
];
