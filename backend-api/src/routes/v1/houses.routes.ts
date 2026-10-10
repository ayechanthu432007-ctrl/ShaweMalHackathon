import { Router } from 'express';

import {
  createHouseBookingController,
  getHouseDetailsController,
  listHousesController
} from '../../controllers/house.controller';
import { recordHouseEventController } from '../../controllers/agent-plan.controller';
import { optionalAuth, requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { houseEventValidator } from '../../validators/agent-plan.validator';
import { houseBookingValidator, houseIdParamValidator, houseListValidator } from '../../validators/house.validator';

const housesRouter = Router();

housesRouter.get('/', houseListValidator, validateMiddleware, asyncHandler(listHousesController));
housesRouter.get('/:id', houseIdParamValidator, validateMiddleware, asyncHandler(getHouseDetailsController));
housesRouter.post('/:id/bookings', requireAuth, houseBookingValidator, validateMiddleware, asyncHandler(createHouseBookingController));
housesRouter.post('/:id/events', optionalAuth, houseEventValidator, validateMiddleware, asyncHandler(recordHouseEventController));

export { housesRouter };
