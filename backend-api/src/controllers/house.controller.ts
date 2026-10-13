import { Request, Response } from 'express';

import { createBooking } from '../services/booking.service';
import { getHouseDetails, getRelatedHouses, listHouses } from '../services/house.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
};

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

export const listHousesController = async (req: Request, res: Response): Promise<void> => {
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 10), 50);

  const payload = await listHouses({
    city: typeof req.query.city === 'string' ? req.query.city : undefined,
    propertyType: typeof req.query.type === 'string' ? req.query.type : undefined,
    minBudget: parseOptionalNumber(req.query.minBudget),
    maxBudget: parseOptionalNumber(req.query.maxBudget),
    page,
    pageSize
  });

  sendSuccess(res, 200, 'Houses fetched successfully', payload);
};

export const getHouseDetailsController = async (req: Request, res: Response): Promise<void> => {
  const item = await getHouseDetails(String(req.params.id ?? ''));
  sendSuccess(res, 200, 'House details fetched successfully', { item });
};

export const getRelatedHousesController = async (req: Request, res: Response): Promise<void> => {
  const items = await getRelatedHouses(String(req.params.id ?? ''));
  sendSuccess(res, 200, 'Related houses fetched successfully', { items });
};

export const createHouseBookingController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);

  const booking = await createBooking({
    userId,
    houseId: String(req.params.id ?? '')
  });

  sendSuccess(res, 201, 'Booking created successfully', {
    booking,
    promptMovingService: true
  });
};
