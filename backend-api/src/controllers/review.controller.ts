import { Request, Response } from 'express';
import { ReviewTargetType } from '@prisma/client';

import { createReview, getReviewSummary, listReviews } from '../services/review.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

const parseTargetType = (value: unknown): ReviewTargetType | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const upper = value.toUpperCase();
  if (upper === 'AGENT' || upper === 'DRIVER') {
    return upper as ReviewTargetType;
  }

  return undefined;
};

const optionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createReviewController = async (req: Request, res: Response): Promise<void> => {
  const reviewerUserId = requireActor(req);

  const { item, created } = await createReview({
    reviewerUserId,
    rating: Number(req.body.rating),
    comment: typeof req.body.comment === 'string' ? req.body.comment : undefined,
    bookingId: optionalTrimmed(req.body.bookingId),
    movingRequestId: optionalTrimmed(req.body.movingRequestId)
  });

  sendSuccess(
    res,
    created ? 201 : 200,
    created ? 'Review submitted successfully' : 'Review updated successfully',
    { item }
  );
};

export const listReviewsController = async (req: Request, res: Response): Promise<void> => {
  const payload = await listReviews({
    targetType: parseTargetType(req.query.targetType) as ReviewTargetType,
    targetUserId: String(req.query.targetUserId ?? '')
  });

  sendSuccess(res, 200, 'Reviews fetched successfully', payload);
};

export const reviewSummaryController = async (req: Request, res: Response): Promise<void> => {
  const payload = await getReviewSummary({
    targetType: parseTargetType(req.query.targetType) as ReviewTargetType,
    targetUserId: optionalTrimmed(req.query.targetUserId)
  });

  sendSuccess(res, 200, 'Review summary fetched successfully', payload);
};
