import { MovingRequestStatus } from '@prisma/client';
import { body, param, query } from 'express-validator';

import { normalizeEmailAddress } from '../utils/email';

const movingRequestStatusQueryValues = [
  ...Object.values(MovingRequestStatus),
  ...Object.values(MovingRequestStatus).map((status) => status.toLowerCase())
];

const allowedRoles = ['normal', 'agent', 'driver', 'admin'];
const verificationActions = ['pending', 'approve', 'reject'];

const userIdParamValidator = [param('userId').trim().notEmpty().withMessage('userId is required.')];

export const adminCreateUserValidator = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Email is invalid.')
    .customSanitizer(normalizeEmailAddress),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required.')
    .isLength({ min: 7, max: 20 })
    .withMessage('Phone length must be between 7 and 20.'),
  body('password').notEmpty().withMessage('Password is required.').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('role').isIn(allowedRoles).withMessage('Role is invalid.')
];

export const adminUpdateRolesValidator = [
  param('id').trim().notEmpty().withMessage('User id is required.'),
  body('roles').isArray({ min: 1 }).withMessage('Roles must be a non-empty array.'),
  body('roles.*').isIn(allowedRoles).withMessage('One or more roles are invalid.')
];

export const adminVerificationValidator = [
  ...userIdParamValidator,
  body('status').isIn(verificationActions).withMessage('Status must be pending, approve, or reject.'),
  body('rejectionReason')
    .optional({ values: 'null' })
    .isString()
    .withMessage('rejectionReason must be a string.')
    .isLength({ max: 500 })
    .withMessage('rejectionReason must be at most 500 characters.')
];

export const adminVerificationListValidator = [
  query('status')
    .optional()
    .isIn(['PENDING', 'VERIFIED', 'REJECTED', 'all', 'pending', 'verified', 'rejected', 'ALL'])
    .withMessage('status must be PENDING, VERIFIED, REJECTED, or all.'),
  query('q').optional().trim().isLength({ max: 100 }).withMessage('q must be at most 100 characters.'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('pageSize').optional().isInt({ min: 1, max: 50 }).withMessage('pageSize must be between 1 and 50.')
];

export const adminRegistrationLookupValidator = [...userIdParamValidator];

export const adminAssignMovingRequestValidator = [
  param('id').trim().notEmpty().withMessage('Moving request id is required.'),
  body('driverUserId').trim().notEmpty().withMessage('driverUserId is required.')
];

export const adminAssignableMovingRequestsValidator = [
  query('orderNumber').optional().trim().isLength({ max: 40 }).withMessage('orderNumber must be at most 40 characters.')
];

export const adminHouseBookingReportValidator = [
  query('from').optional().isISO8601().withMessage('from must be a valid date.'),
  query('to').optional().isISO8601().withMessage('to must be a valid date.'),
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'pending', 'confirmed', 'cancelled']).withMessage('status is invalid.'),
  query('houseId').optional().trim(),
  query('agentId').optional().trim(),
  query('userId').optional().trim()
];

export const adminMovingRequestReportValidator = [
  query('from').optional().isISO8601().withMessage('from must be a valid date.'),
  query('to').optional().isISO8601().withMessage('to must be a valid date.'),
  query('status').optional().isIn(movingRequestStatusQueryValues).withMessage('status is invalid.')
];
