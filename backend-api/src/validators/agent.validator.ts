import { body, param } from 'express-validator';

import { optionalUploadedPathValidator, uploadedPathArrayItemValidator, uploadedPathValidator } from './upload-path.validator';

const postChannelValues = ['agent', 'roommate'];
const availabilityValues = ['available', 'not_available'];

const nonNegativeNumericFields = [
  body('monthlyFees').isFloat({ min: 0 }).withMessage('monthlyFees must be a non-negative number.'),
  body('depositAmount').isFloat({ min: 0 }).withMessage('depositAmount must be a non-negative number.'),
  body('bedrooms').isInt({ min: 0 }).withMessage('bedrooms must be a non-negative integer.'),
  body('bathrooms').isInt({ min: 0 }).withMessage('bathrooms must be a non-negative integer.')
];

export const agentProfileUpsertValidator = [
  body('name').trim().notEmpty().withMessage('name is required.'),
  body('nrc').trim().isLength({ min: 15, max: 15 }).withMessage('nrc must be exactly 15 characters.'),
  uploadedPathValidator('nrcFrontPhotoPath', 'docs'),
  uploadedPathValidator('nrcBackPhotoPath', 'docs'),
  optionalUploadedPathValidator('profilePhotoPath', 'profile'),
  body('email').trim().isEmail().withMessage('email is invalid.'),
  body('phone').trim().notEmpty().withMessage('phone is required.'),
  body('telegram').optional().isString().withMessage('telegram must be a string.'),
  body('viber').optional().isString().withMessage('viber must be a string.'),
  body('address1').trim().notEmpty().withMessage('address1 is required.'),
  body('address2').optional().isString().withMessage('address2 must be a string.'),
  body('cityId').trim().notEmpty().withMessage('cityId is required.'),
  body('stateId').trim().notEmpty().withMessage('stateId is required.'),
  body('serviceRegionId').trim().notEmpty().withMessage('serviceRegionId is required.'),
  body('hasRentingExperience').isBoolean().withMessage('hasRentingExperience must be boolean.')
];

export const agentHouseCreateValidator = [
  body('title').trim().notEmpty().withMessage('title is required.'),
  body('description').optional().isString().withMessage('description must be a string.'),
  body('postChannel').isIn(postChannelValues).withMessage('postChannel must be one of: agent, roommate.'),
  body('propertyTypeId').trim().notEmpty().withMessage('propertyTypeId is required.'),
  body('contractTypeId').trim().notEmpty().withMessage('contractTypeId is required.'),
  body('areaSize').optional().isString().withMessage('areaSize must be a string.'),
  body('floorLevelId').optional().isString().withMessage('floorLevelId must be a string.'),
  ...nonNegativeNumericFields,
  body('houseRules').optional().isString().withMessage('houseRules must be a string.'),
  body('contactTelegram').optional().isString().withMessage('contactTelegram must be a string.'),
  body('contactViber').optional().isString().withMessage('contactViber must be a string.'),
  body('contactPhoneNumber').trim().notEmpty().withMessage('contactPhoneNumber is required.'),
  body('cityId').trim().notEmpty().withMessage('cityId is required.'),
  body('stateId').trim().notEmpty().withMessage('stateId is required.'),
  body('streetAddress').optional({ values: 'falsy' }).isString().withMessage('streetAddress must be a string.'),
  body('latitude').custom((value) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return true;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
      throw new Error('latitude must be a number between -90 and 90.');
    }
    return true;
  }),
  body('longitude').custom((value) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return true;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
      throw new Error('longitude must be a number between -180 and 180.');
    }
    return true;
  }),
  body().custom((_, { req }) => {
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const hasLatitude = latitude !== undefined && latitude !== null && String(latitude).trim() !== '';
    const hasLongitude = longitude !== undefined && longitude !== null && String(longitude).trim() !== '';
    if (hasLatitude !== hasLongitude) {
      throw new Error('latitude and longitude must be provided together.');
    }
    return true;
  }),
  body('nearbyPlaces').optional().isString().withMessage('nearbyPlaces must be a string.'),
  body('availability').isIn(availabilityValues).withMessage('availability must be available or not_available.'),
  body('imagePaths').isArray({ min: 1, max: 5 }).withMessage('imagePaths must be an array with 1 to 5 entries.'),
  uploadedPathArrayItemValidator('imagePaths', 'houses'),
  body('amenityIds').optional().isArray().withMessage('amenityIds must be an array.'),
  body('amenityIds.*').optional().isString().withMessage('Each amenity id must be a string.')
];

export const agentHouseUpdateValidator = [param('id').trim().notEmpty().withMessage('House id is required.'), ...agentHouseCreateValidator];

export const agentHouseIdParamValidator = [param('id').trim().notEmpty().withMessage('House id is required.')];
