import { Router } from 'express';

import {
  cancelMyMovingRequestController,
  createMovingRequestController,
  getMovingRequestController,
  listMyMovingRequestsController,
  quoteMovingRequestController
} from '../../controllers/moving.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  movingRequestCreateValidator,
  movingRequestIdParamValidator,
  movingRequestQuoteValidator
} from '../../validators/moving.validator';

const movingRouter = Router();

movingRouter.use(requireAuth);
movingRouter.post('/quote', movingRequestQuoteValidator, validateMiddleware, asyncHandler(quoteMovingRequestController));
movingRouter.post('/requests', movingRequestCreateValidator, validateMiddleware, asyncHandler(createMovingRequestController));
movingRouter.get('/requests', asyncHandler(listMyMovingRequestsController));
movingRouter.get('/requests/:id', movingRequestIdParamValidator, validateMiddleware, asyncHandler(getMovingRequestController));
movingRouter.post('/requests/:id/cancel', movingRequestIdParamValidator, validateMiddleware, asyncHandler(cancelMyMovingRequestController));

export { movingRouter };
