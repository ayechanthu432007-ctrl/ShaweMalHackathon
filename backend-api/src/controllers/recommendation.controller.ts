import { Request, Response } from 'express';

import {
  getHousingPreferences,
  matchTenantsForListing,
  occupationCompatibilityForListing,
  recommendHouses,
  recommendRoommates,
  saveHousingPreferences
} from '../services/recommendation.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

/** Keeps "not sent" (leave unchanged) apart from an explicit null (clear the answer). */
const optional = <T>(value: unknown, convert: (raw: unknown) => T): T | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return convert(value);
};

const toBoolean = (raw: unknown): boolean => raw === true || raw === 'true';

export const getHousingPreferencesController = async (req: Request, res: Response): Promise<void> => {
  const data = await getHousingPreferences(requireActor(req));
  sendSuccess(res, 200, 'Housing preferences fetched successfully', data);
};

export const saveHousingPreferencesController = async (req: Request, res: Response): Promise<void> => {
  const body = req.body;
  const data = await saveHousingPreferences(requireActor(req), {
    occupationId: optional(body.occupationId, String),
    budgetMin: optional(body.budgetMin, Number),
    budgetMax: optional(body.budgetMax, Number),
    preferredCityId: optional(body.preferredCityId, String),
    propertyTypeId: optional(body.propertyTypeId, String),
    bedroomsMin: optional(body.bedroomsMin, Number),
    wantsFurnished: optional(body.wantsFurnished, toBoolean),
    needsInternet: optional(body.needsInternet, toBoolean),
    needsQuiet: optional(body.needsQuiet, toBoolean),
    amenityIds: Array.isArray(body.amenityIds) ? body.amenityIds.map(String) : undefined,
    moveInDate: optional(body.moveInDate, (raw) => new Date(String(raw))),
    leaseMonths: optional(body.leaseMonths, Number),
    roomArrangement: optional(body.roomArrangement, String),
    cleanliness: optional(body.cleanliness, String),
    sleepSchedule: optional(body.sleepSchedule, String),
    smoking: optional(body.smoking, String),
    noiseTolerance: optional(body.noiseTolerance, String),
    socialLevel: optional(body.socialLevel, String),
    guests: optional(body.guests, String),
    sharesChores: optional(body.sharesChores, toBoolean),
    visibleToAgents: body.visibleToAgents === undefined ? undefined : toBoolean(body.visibleToAgents)
  });
  sendSuccess(res, 200, 'Housing preferences saved successfully', data);
};

export const recommendHousesController = async (req: Request, res: Response): Promise<void> => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  sendSuccess(res, 200, 'House recommendations calculated successfully', await recommendHouses(requireActor(req), limit));
};

export const recommendRoommatesController = async (req: Request, res: Response): Promise<void> => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 6;
  sendSuccess(res, 200, 'Roommate recommendations calculated successfully', await recommendRoommates(requireActor(req), page, pageSize));
};

export const tenantMatchesController = async (req: Request, res: Response): Promise<void> => {
  const body = req.body;
  const data = await matchTenantsForListing(
    requireActor(req),
    {
      monthlyFees: Number(body.monthlyFees),
      cityId: String(body.cityId),
      stateId: String(body.stateId ?? ''),
      propertyTypeId: String(body.propertyTypeId ?? ''),
      contractTypeId: body.contractTypeId ? String(body.contractTypeId) : null,
      bedrooms: Number(body.bedrooms ?? 0),
      amenityIds: Array.isArray(body.amenityIds) ? body.amenityIds.map(String) : [],
      nearbyPlaces: typeof body.nearbyPlaces === 'string' ? body.nearbyPlaces : null,
      description: typeof body.description === 'string' ? body.description : null,
      houseRules: typeof body.houseRules === 'string' ? body.houseRules : null
    },
    body.page ? Number(body.page) : 1,
    body.pageSize ? Number(body.pageSize) : 5
  );
  sendSuccess(res, 200, 'Potential tenants calculated successfully', data);
};

const optionalNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(parsed) ? null : parsed;
};
const optionalText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export const occupationCompatibilityController = async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const data = await occupationCompatibilityForListing({
    monthlyFees: optionalNumber(body.monthlyFees),
    bedrooms: optionalNumber(body.bedrooms),
    bathrooms: optionalNumber(body.bathrooms),
    areaSize: optionalText(body.areaSize),
    amenityIds: Array.isArray(body.amenityIds) ? body.amenityIds.map(String) : [],
    nearbyPlaces: optionalText(body.nearbyPlaces),
    description: optionalText(body.description),
    houseRules: optionalText(body.houseRules)
  });
  sendSuccess(res, 200, 'Occupation compatibility calculated', data);
};
