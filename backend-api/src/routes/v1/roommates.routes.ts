import { Router } from 'express';

import {
  createRoommateController,
  deleteRoommateController,
  listRoommatesController,
  updateRoommateController
} from '../../controllers/roommate.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  createRoommateValidator,
  listRoommatesValidator,
  roommateIdParamValidator,
  updateRoommateValidator
} from '../../validators/roommate.validator';

const roommatesRouter = Router();

roommatesRouter.get('/', listRoommatesValidator, validateMiddleware, asyncHandler(listRoommatesController));
roommatesRouter.post('/', requireAuth, createRoommateValidator, validateMiddleware, asyncHandler(createRoommateController));
roommatesRouter.put('/:id', requireAuth, updateRoommateValidator, validateMiddleware, asyncHandler(updateRoommateController));
roommatesRouter.delete('/:id', requireAuth, roommateIdParamValidator, validateMiddleware, asyncHandler(deleteRoommateController));

export { roommatesRouter };
