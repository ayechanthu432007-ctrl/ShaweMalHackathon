import { body } from 'express-validator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 120 }).withMessage('Name is too long.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .matches(EMAIL_REGEX)
    .withMessage('Email format is invalid.')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required.')
    .isLength({ min: 7, max: 20 })
    .withMessage('Phone length must be between 7 and 20.'),
  body('occupationId').isString().withMessage('Occupation is required.').trim().notEmpty().withMessage('Occupation is required.'),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required.')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.')
];

export const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .matches(EMAIL_REGEX)
    .withMessage('Email format is invalid.')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
  body('rememberMe').optional().isBoolean().withMessage('Remember me must be boolean.')
];

export const refreshValidator = [
  body('refreshToken').trim().notEmpty().withMessage('Refresh token is required.')
];

export const logoutValidator = [
  body('refreshToken').trim().notEmpty().withMessage('Refresh token is required.')
];
