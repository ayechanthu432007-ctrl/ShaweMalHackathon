import { Router } from 'express';

import {
	changePasswordController,
	getMyProfileController,
	getMyProfileHistoryController,
	updateMyProfileController
} from '../../controllers/profile.controller';
import { getHousingPreferencesController, saveHousingPreferencesController } from '../../controllers/recommendation.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { changePasswordValidator, updateProfileValidator } from '../../validators/profile.validator';
import { housingPreferencesValidator } from '../../validators/recommendation.validator';

const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', asyncHandler(getMyProfileController));
profileRouter.patch('/', updateProfileValidator, validateMiddleware, asyncHandler(updateMyProfileController));
profileRouter.get('/housing-preferences', asyncHandler(getHousingPreferencesController));
profileRouter.put('/housing-preferences', housingPreferencesValidator, validateMiddleware, asyncHandler(saveHousingPreferencesController));
profileRouter.get('/history', asyncHandler(getMyProfileHistoryController));
profileRouter.patch('/change-password', changePasswordValidator, validateMiddleware, asyncHandler(changePasswordController));

export { profileRouter };
