import { Router } from 'express';

import { recommendHousesController, recommendRoommatesController } from '../../controllers/recommendation.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { houseRecommendationsValidator, roommateRecommendationsValidator } from '../../validators/recommendation.validator';

const recommendationsRouter = Router();

// Recommendations are personal: they are only ever calculated for the signed-in person.
recommendationsRouter.use(requireAuth);
recommendationsRouter.get('/houses', houseRecommendationsValidator, validateMiddleware, asyncHandler(recommendHousesController));
recommendationsRouter.get('/roommates', roommateRecommendationsValidator, validateMiddleware, asyncHandler(recommendRoommatesController));

export { recommendationsRouter };
