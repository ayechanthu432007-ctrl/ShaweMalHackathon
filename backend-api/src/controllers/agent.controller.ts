import { Request, Response } from 'express';
import { HouseAvailabilityStatus, HousePostChannel } from '@prisma/client';

import {
  createAgentHouse,
  deleteAgentHouse,
  listAgentHouses,
  updateAgentHouse,
  upsertAgentProfile
} from '../services/agent.service';
import { listAgentBookings } from '../services/booking.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

const parsePostChannel = (value: string): HousePostChannel => {
  if (value.toLowerCase() === 'roommate') {
    return HousePostChannel.ROOMMATE;
  }

  return HousePostChannel.AGENT;
};

const parseAvailability = (value: string): HouseAvailabilityStatus => {
  if (value.toLowerCase() === 'not_available') {
    return HouseAvailabilityStatus.NOT_AVAILABLE;
  }

  return HouseAvailabilityStatus.AVAILABLE;
};

const parseOptionalCoordinate = (value: unknown): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return Number(value);
};

const mapHousePayload = (body: Request['body']) => ({
  title: String(body.title),
  description: body.description ? String(body.description) : undefined,
  postChannel: parsePostChannel(String(body.postChannel)),
  propertyTypeId: String(body.propertyTypeId),
  monthlyFees: Number(body.monthlyFees),
  depositAmount: Number(body.depositAmount),
  contractTypeId: String(body.contractTypeId),
  areaSize: body.areaSize ? String(body.areaSize) : undefined,
  floorLevelId: body.floorLevelId ? String(body.floorLevelId) : undefined,
  bedrooms: Number(body.bedrooms),
  bathrooms: Number(body.bathrooms),
  houseRules: body.houseRules ? String(body.houseRules) : undefined,
  contactTelegram: body.contactTelegram ? String(body.contactTelegram) : undefined,
  contactViber: body.contactViber ? String(body.contactViber) : undefined,
  contactPhoneNumber: String(body.contactPhoneNumber),
  cityId: String(body.cityId),
  stateId: String(body.stateId),
  streetAddress: body.streetAddress ? String(body.streetAddress) : undefined,
  latitude: parseOptionalCoordinate(body.latitude),
  longitude: parseOptionalCoordinate(body.longitude),
  nearbyPlaces: body.nearbyPlaces ? String(body.nearbyPlaces) : undefined,
  availability: parseAvailability(String(body.availability)),
  imagePaths: Array.isArray(body.imagePaths) ? body.imagePaths.map((item: unknown) => String(item)) : [],
  amenityIds: Array.isArray(body.amenityIds) ? body.amenityIds.map((item: unknown) => String(item)) : []
});

export const upsertAgentProfileController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);

  const profile = await upsertAgentProfile(userId, {
    name: String(req.body.name),
    nrc: String(req.body.nrc),
    nrcFrontPhotoPath: String(req.body.nrcFrontPhotoPath),
    nrcBackPhotoPath: String(req.body.nrcBackPhotoPath),
    email: String(req.body.email),
    phone: String(req.body.phone),
    telegram: req.body.telegram ? String(req.body.telegram) : undefined,
    viber: req.body.viber ? String(req.body.viber) : undefined,
    address1: String(req.body.address1),
    address2: req.body.address2 ? String(req.body.address2) : undefined,
    cityId: String(req.body.cityId),
    stateId: String(req.body.stateId),
    serviceRegionId: String(req.body.serviceRegionId),
    hasRentingExperience: Boolean(req.body.hasRentingExperience),
    profilePhotoPath: typeof req.body.profilePhotoPath === 'string' ? req.body.profilePhotoPath : undefined
  });

  sendSuccess(res, 200, 'Agent profile saved successfully', { profile });
};

export const createAgentHouseController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const house = await createAgentHouse(userId, mapHousePayload(req.body));

  sendSuccess(res, 201, 'House created successfully', { house });
};

export const listAgentHousesController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const items = await listAgentHouses(userId);

  sendSuccess(res, 200, 'Agent houses fetched successfully', { items });
};

export const listAgentBookingsController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const items = await listAgentBookings(userId);

  sendSuccess(res, 200, 'Agent house bookings fetched successfully', { items });
};

export const updateAgentHouseController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const houseId = String(req.params.id ?? '');

  const house = await updateAgentHouse(userId, houseId, mapHousePayload(req.body));
  sendSuccess(res, 200, 'House updated successfully', { house });
};

export const deleteAgentHouseController = async (req: Request, res: Response): Promise<void> => {
  const userId = requireActor(req);
  const houseId = String(req.params.id ?? '');

  await deleteAgentHouse(userId, houseId);
  sendSuccess(res, 200, 'House deleted successfully', { ok: true });
};
