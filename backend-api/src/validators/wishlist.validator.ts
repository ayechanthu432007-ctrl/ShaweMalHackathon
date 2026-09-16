import { param } from 'express-validator';

export const wishlistHouseParamValidator = [param('houseId').trim().notEmpty().withMessage('houseId is required.')];

export const wishlistListingParamValidator = [param('listingId').trim().notEmpty().withMessage('listingId is required.')];
