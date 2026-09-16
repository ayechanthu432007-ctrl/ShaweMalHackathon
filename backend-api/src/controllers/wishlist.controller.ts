import { Request, Response } from 'express';

import {
  addListingToWishlist,
  addToWishlist,
  listListingWishlist,
  listWishlist,
  removeFromWishlist,
  removeListingFromWishlist
} from '../services/wishlist.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

export const addWishlistController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const houseId = String(req.params.houseId ?? '');

  const item = await addToWishlist(userId, houseId);
  sendSuccess(res, 201, 'Added to wishlist', { item });
};

export const removeWishlistController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const houseId = String(req.params.houseId ?? '');

  await removeFromWishlist(userId, houseId);
  sendSuccess(res, 200, 'Removed from wishlist', { ok: true });
};

export const listWishlistController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);

  const items = await listWishlist(userId);
  sendSuccess(res, 200, 'Wishlist fetched successfully', { items });
};

export const addListingWishlistController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const listingId = String(req.params.listingId ?? '');

  const item = await addListingToWishlist(userId, listingId);
  sendSuccess(res, 201, 'Saved to wishlist', { item });
};

export const removeListingWishlistController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const listingId = String(req.params.listingId ?? '');

  await removeListingFromWishlist(userId, listingId);
  sendSuccess(res, 200, 'Removed from wishlist', { ok: true });
};

export const listListingWishlistController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);

  const items = await listListingWishlist(userId);
  sendSuccess(res, 200, 'Saved items fetched successfully', { items });
};
