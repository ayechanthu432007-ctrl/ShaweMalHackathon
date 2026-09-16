import { Router } from 'express';

import {
  addListingWishlistController,
  addWishlistController,
  listListingWishlistController,
  listWishlistController,
  removeListingWishlistController,
  removeWishlistController
} from '../../controllers/wishlist.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { wishlistHouseParamValidator, wishlistListingParamValidator } from '../../validators/wishlist.validator';

const wishlistRouter = Router();

wishlistRouter.use(requireAuth);
wishlistRouter.get('/listings', asyncHandler(listListingWishlistController));
wishlistRouter.post('/listings/:listingId', wishlistListingParamValidator, validateMiddleware, asyncHandler(addListingWishlistController));
wishlistRouter.delete('/listings/:listingId', wishlistListingParamValidator, validateMiddleware, asyncHandler(removeListingWishlistController));
wishlistRouter.post('/:houseId', wishlistHouseParamValidator, validateMiddleware, asyncHandler(addWishlistController));
wishlistRouter.delete('/:houseId', wishlistHouseParamValidator, validateMiddleware, asyncHandler(removeWishlistController));
wishlistRouter.get('/', asyncHandler(listWishlistController));

export { wishlistRouter };
