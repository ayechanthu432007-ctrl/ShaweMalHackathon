import { body, param, query } from 'express-validator';

const idParam = (name: string) => param(name).trim().notEmpty().withMessage(`${name} is required.`);

const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be between 1 and 100.')
];

const optionalNote = (field: string) =>
  body(field).optional({ values: 'falsy' }).isString().isLength({ max: 500 }).withMessage(`${field} must be at most 500 characters.`);

export const adminListingsValidator = [
  ...paginationValidators,
  query('q').optional().isString().isLength({ max: 100 }),
  query('status').optional().isIn(['ACTIVE', 'SOLD']).withMessage('status must be ACTIVE or SOLD.'),
  query('moderationStatus')
    .optional()
    .isIn(['PENDING', 'APPROVED', 'REJECTED', 'REMOVED'])
    .withMessage('moderationStatus is invalid.'),
  query('reported').optional().isIn(['true', 'false']).withMessage('reported must be true or false.'),
  query('sellerId').optional().isString()
];

export const adminListingIdValidator = [idParam('id')];

export const adminModerateListingValidator = [
  idParam('id'),
  body('action').isIn(['approve', 'reject', 'remove', 'restore']).withMessage('action must be approve, reject, remove, or restore.'),
  optionalNote('note'),
  body('note').custom((value, { req }) => {
    if ((req.body?.action === 'reject' || req.body?.action === 'remove') && !(typeof value === 'string' && value.trim())) {
      throw new Error('Please give the seller a reason.');
    }
    return true;
  })
];

export const adminListingCategoryValidator = [
  idParam('id'),
  body('categoryId').isString().trim().notEmpty().withMessage('categoryId is required.'),
  body('subcategoryId').optional({ values: 'null' }).isString()
];

export const adminReportsValidator = [
  ...paginationValidators,
  query('status').optional().isIn(['OPEN', 'RESOLVED', 'DISMISSED']).withMessage('status is invalid.')
];

export const adminResolveReportValidator = [
  idParam('id'),
  body('status').isIn(['RESOLVED', 'DISMISSED']).withMessage('status must be RESOLVED or DISMISSED.'),
  optionalNote('adminNote'),
  body('removeListing').optional().isBoolean().withMessage('removeListing must be a boolean.')
];

export const adminMarketplaceUsersValidator = [
  ...paginationValidators,
  query('q').optional().isString().isLength({ max: 100 }),
  query('accountStatus').optional().isIn(['ACTIVE', 'SUSPENDED', 'BANNED']).withMessage('accountStatus is invalid.'),
  query('verification')
    .optional()
    .isIn(['phone_unverified', 'phone_verified', 'identity_verified', 'trusted'])
    .withMessage('verification is invalid.'),
  query('reported').optional().isIn(['true', 'false']).withMessage('reported must be true or false.')
];

export const adminUserIdValidator = [idParam('id')];

export const adminAccountStatusValidator = [
  idParam('id'),
  body('accountStatus').isIn(['ACTIVE', 'SUSPENDED', 'BANNED']).withMessage('accountStatus must be ACTIVE, SUSPENDED, or BANNED.'),
  optionalNote('reason')
];

export const adminSellerVerificationValidator = [
  idParam('id'),
  body('phoneVerified').optional().isBoolean().withMessage('phoneVerified must be a boolean.'),
  body('identityVerified').optional().isBoolean().withMessage('identityVerified must be a boolean.'),
  body('trustedSeller').optional().isBoolean().withMessage('trustedSeller must be a boolean.'),
  body().custom((_, { req }) => {
    const keys = ['phoneVerified', 'identityVerified', 'trustedSeller'];
    if (!keys.some((key) => typeof req.body?.[key] === 'boolean')) {
      throw new Error('Provide at least one verification flag.');
    }
    return true;
  })
];
