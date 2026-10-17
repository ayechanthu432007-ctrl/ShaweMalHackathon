import { body, query } from 'express-validator';

import {
  CLEANLINESS_LEVELS,
  GUEST_LEVELS,
  NOISE_LEVELS,
  ROOM_ARRANGEMENTS,
  SLEEP_SCHEDULES,
  SMOKING_CHOICES,
  SOCIAL_LEVELS
} from '../services/matching';

const MAX_RENT = 1_000_000_000;

const nullable = (field: string) => body(field).optional({ values: 'null' });
const choice = (field: string, values: readonly string[]) =>
  nullable(field).isIn([...values]).withMessage(`${field} must be one of: ${values.join(', ')}.`);
const flag = (field: string) => nullable(field).isBoolean().withMessage(`${field} must be true or false.`);

export const housingPreferencesValidator = [
  nullable('occupationId').isString().trim().notEmpty().withMessage('occupationId must be a non-empty string.'),
  nullable('budgetMin').isInt({ min: 0, max: MAX_RENT }).withMessage('budgetMin must be a whole number of MMK.'),
  nullable('budgetMax').isInt({ min: 0, max: MAX_RENT }).withMessage('budgetMax must be a whole number of MMK.'),
  nullable('preferredCityId').isString().trim().notEmpty().withMessage('preferredCityId must be a non-empty string.'),
  nullable('propertyTypeId').isString().trim().notEmpty().withMessage('propertyTypeId must be a non-empty string.'),
  nullable('bedroomsMin').isInt({ min: 0, max: 20 }).withMessage('bedroomsMin must be between 0 and 20.'),
  flag('wantsFurnished'),
  flag('needsInternet'),
  flag('needsQuiet'),
  body('amenityIds').optional().isArray({ max: 40 }).withMessage('amenityIds must be a list.'),
  body('amenityIds.*').isString().withMessage('amenityIds must contain ids.'),
  nullable('moveInDate').isISO8601().withMessage('moveInDate must be a date.'),
  nullable('leaseMonths').isInt({ min: 1, max: 60 }).withMessage('leaseMonths must be between 1 and 60.'),
  choice('roomArrangement', ROOM_ARRANGEMENTS),
  choice('cleanliness', CLEANLINESS_LEVELS),
  choice('sleepSchedule', SLEEP_SCHEDULES),
  choice('smoking', SMOKING_CHOICES),
  choice('noiseTolerance', NOISE_LEVELS),
  choice('socialLevel', SOCIAL_LEVELS),
  choice('guests', GUEST_LEVELS),
  flag('sharesChores'),
  body('visibleToAgents').optional().isBoolean().withMessage('visibleToAgents must be true or false.')
];

export const houseRecommendationsValidator = [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('limit must be between 1 and 20.')
];

export const roommateRecommendationsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number.'),
  query('pageSize').optional().isInt({ min: 1, max: 30 }).withMessage('pageSize must be between 1 and 30.')
];

/** A listing still being written: only what the scoring needs is required. */
export const tenantMatchesValidator = [
  body('monthlyFees').isFloat({ min: 1, max: MAX_RENT }).withMessage('monthlyFees is required.'),
  body('cityId').isString().trim().notEmpty().withMessage('cityId is required.'),
  body('stateId').optional().isString().withMessage('stateId must be a string.'),
  body('propertyTypeId').optional().isString().withMessage('propertyTypeId must be a string.'),
  body('contractTypeId').optional({ values: 'falsy' }).isString().withMessage('contractTypeId must be a string.'),
  body('bedrooms').optional().isInt({ min: 0, max: 50 }).withMessage('bedrooms must be a whole number.'),
  body('amenityIds').optional().isArray({ max: 60 }).withMessage('amenityIds must be a list.'),
  body('amenityIds.*').isString().withMessage('amenityIds must contain ids.'),
  body('nearbyPlaces').optional({ values: 'null' }).isString().isLength({ max: 2000 }).withMessage('nearbyPlaces is too long.'),
  body('description').optional({ values: 'null' }).isString().isLength({ max: 5000 }).withMessage('description is too long.'),
  body('houseRules').optional({ values: 'null' }).isString().isLength({ max: 5000 }).withMessage('houseRules is too long.'),
  body('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number.'),
  body('pageSize').optional().isInt({ min: 1, max: 20 }).withMessage('pageSize must be between 1 and 20.')
];

export const occupationCompatibilityValidator = [
  body('monthlyFees').optional({ values: 'falsy' }).isFloat({ min: 0, max: MAX_RENT }).withMessage('monthlyFees must be a number.'),
  body('bedrooms').optional({ values: 'falsy' }).isInt({ min: 0, max: 50 }).withMessage('bedrooms must be a whole number.'),
  body('bathrooms').optional({ values: 'falsy' }).isInt({ min: 0, max: 50 }).withMessage('bathrooms must be a whole number.'),
  body('areaSize').optional({ values: 'null' }).isString().isLength({ max: 100 }).withMessage('areaSize is too long.'),
  body('amenityIds').optional().isArray({ max: 60 }).withMessage('amenityIds must be a list.'),
  body('amenityIds.*').isString().withMessage('amenityIds must contain ids.'),
  body('nearbyPlaces').optional({ values: 'null' }).isString().isLength({ max: 2000 }).withMessage('nearbyPlaces is too long.'),
  body('description').optional({ values: 'null' }).isString().isLength({ max: 5000 }).withMessage('description is too long.'),
  body('houseRules').optional({ values: 'null' }).isString().isLength({ max: 5000 }).withMessage('houseRules is too long.')
];
