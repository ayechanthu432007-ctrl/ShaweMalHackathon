import { body, param, query } from 'express-validator';

export const performanceQueryValidator = [query('days').optional().isInt({ min: 1, max: 90 }).withMessage('days must be between 1 and 90.')];

export const monthlyReportQueryValidator = [
  query('month').optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('month must be YYYY-MM.')
];

export const subscriptionOrderValidator = [
  body('planCode').isString().trim().notEmpty().withMessage('planCode is required.'),
  body('billingMonths').isInt().isIn([1, 3]).withMessage('billingMonths must be 1 or 3.')
];

export const boostOrderValidator = [
  body('houseId').isString().trim().notEmpty().withMessage('houseId is required.'),
  body('days').isInt({ min: 1, max: 30 }).withMessage('days must be between 1 and 30.')
];

export const orderReferenceValidator = [param('reference').matches(/^SM-[A-Z0-9]+-[A-F0-9]{8}$/).withMessage('Invalid order reference.')];

export const demoPaymentValidator = [
  ...orderReferenceValidator,
  body('outcome').isString().trim().toUpperCase().isIn(['SUCCESS', 'PENDING', 'FAILED']).withMessage('outcome must be success, pending or failed.')
];

export const houseEventValidator = [
  param('id').trim().notEmpty().withMessage('id is required.'),
  body('type').isString().trim().toUpperCase().isIn(['VIEW', 'CALL', 'TELEGRAM', 'VIBER']).withMessage('Unknown event type.')
];

export const adminPlanUpdateValidator = [
  param('code').isString().trim().notEmpty().withMessage('code is required.'),
  body('monthlyPriceMmk').optional().isInt({ min: 0, max: 100_000_000 }).withMessage('monthlyPriceMmk must be a whole number of MMK.'),
  body('quarterlyPriceMmk').optional().isInt({ min: 0, max: 100_000_000 }).withMessage('quarterlyPriceMmk must be a whole number of MMK.'),
  body('monthlyListingLimit').optional({ values: 'null' }).isInt({ min: 0, max: 100_000 }).withMessage('monthlyListingLimit must be a whole number or null.'),
  body('freeBoostDays').optional().isInt({ min: 0, max: 365 }).withMessage('freeBoostDays must be a whole number.')
];
