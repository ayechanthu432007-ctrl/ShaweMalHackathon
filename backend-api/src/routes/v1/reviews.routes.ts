import { Router } from 'express';

import { createReviewController, listReviewsController, reviewSummaryController } from '../../controllers/review.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { createReviewValidator, listReviewsValidator, reviewSummaryValidator } from '../../validators/review.validator';

const reviewsRouter = Router();

reviewsRouter.post('/', requireAuth, createReviewValidator, validateMiddleware, asyncHandler(createReviewController));
reviewsRouter.get('/summary', reviewSummaryValidator, validateMiddleware, asyncHandler(reviewSummaryController));
reviewsRouter.get('/', listReviewsValidator, validateMiddleware, asyncHandler(listReviewsController));

export { reviewsRouter };
