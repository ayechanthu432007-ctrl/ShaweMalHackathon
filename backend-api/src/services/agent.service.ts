import { HouseAvailabilityStatus, HousePostChannel, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { LOCKED_TRANSACTION_OPTIONS, lockForTransaction } from '../utils/advisory-lock';
import { cancelBoostsForHouse } from './boost.service';
import { assertListingAllowance, LISTING_CREATED_ACTION } from './subscription.service';

export interface AgentProfileInput {
  name: string;
  nrc: string;
  nrcFrontPhotoPath: string;
  nrcBackPhotoPath: string;
  email: string;
  phone: string;
  telegram?: string;
  viber?: string;
  address1: string;
  address2?: string;
  cityId: string;
  stateId: string;
  serviceRegionId: string;
  hasRentingExperience: boolean;
}

interface AgentHouseInput {
  title: string;
  description?: string;
  postChannel: HousePostChannel;
  propertyTypeId: string;
  monthlyFees: number;
  depositAmount: number;
  contractTypeId: string;
  areaSize?: string;
  floorLevelId?: string;
  bedrooms: number;
  bathrooms: number;
  houseRules?: string;
  contactTelegram?: string;
  contactViber?: string;
  contactPhoneNumber: string;
  cityId: string;
  stateId: string;
  streetAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  nearbyPlaces?: string;
  availability: HouseAvailabilityStatus;
  imagePaths: string[];
  amenityIds: string[];
}

const HOUSE_OWNER_INCLUDE = {
  images: {
    select: {
      id: true,
      imagePath: true,
      sortOrder: true
    },
    orderBy: {
      sortOrder: 'asc' as const
    }
  },
  amenities: {
    include: {
      amenity: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  propertyType: {
    select: {
      id: true,
      name: true
    }
  },
  contractType: {
    select: {
      id: true,
      name: true
    }
  },
  floorLevel: {
    select: {
      id: true,
      name: true
    }
  },
  city: {
    select: {
      id: true,
      name: true
    }
  },
  state: {
    select: {
      id: true,
      name: true
    }
  }
} as const;

const toOptionalDecimal = (value?: number | null): Prisma.Decimal | null => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }

  return new Prisma.Decimal(value);
};

const toOptionalNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const assertVerifiedAgent = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true
        }
      },
      agentProfile: {
        select: {
          verificationStatus: true
        }
      }
    }
  });

  if (!user) {
    throw new ApiError(401, 'AUTH_USER_NOT_FOUND', 'Authenticated user not found.');
  }

  const roleNames = user.userRoles.map((item) => item.role.name);
  if (!roleNames.includes('agent')) {
    throw new ApiError(403, 'AGENT_ROLE_REQUIRED', 'Agent role is required.');
  }

  if (user.agentProfile?.verificationStatus !== 'VERIFIED') {
    throw new ApiError(403, 'AGENT_NOT_VERIFIED', 'Only verified agents can manage houses.');
  }
};

const normalizeHouse = (
  house: Prisma.HouseGetPayload<{ include: typeof HOUSE_OWNER_INCLUDE }>
) => ({
  id: house.id,
  title: house.title,
  description: house.description,
  postChannel: house.postChannel,
  monthlyFees: Number(house.monthlyFees),
  depositAmount: Number(house.depositAmount),
  areaSize: house.areaSize,
  bedrooms: house.bedrooms,
  bathrooms: house.bathrooms,
  houseRules: house.houseRules,
  contactTelegram: house.contactTelegram,
  contactViber: house.contactViber,
  contactPhoneNumber: house.contactPhoneNumber,
  streetAddress: house.streetAddress,
  latitude: toOptionalNumber(house.latitude),
  longitude: toOptionalNumber(house.longitude),
  nearbyPlaces: house.nearbyPlaces,
  availability: house.availability,
  propertyType: house.propertyType,
  contractType: house.contractType,
  floorLevel: house.floorLevel,
  city: house.city,
  state: house.state,
  images: house.images,
  amenities: house.amenities.map((item) => item.amenity),
  createdAt: house.createdAt,
  updatedAt: house.updatedAt
});

export const upsertAgentProfile = async (userId: string, input: AgentProfileInput) => {
  return prisma.agentProfile.upsert({
    where: {
      userId
    },
    update: {
      ...input
    },
    create: {
      userId,
      ...input
    }
  });
};

export const createAgentHouse = async (userId: string, input: AgentHouseInput) => {
  await assertVerifiedAgent(userId);

  // The allowance check, the insert and the usage record run under one per-agent lock,
  // so simultaneous requests cannot all pass the check before any of them is counted.
  const house = await prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, `listing-quota:${userId}`);
    await assertListingAllowance(userId, new Date(), tx);

    const created = await tx.house.create({
      data: {
        agentId: userId,
        title: input.title,
        description: input.description,
        postChannel: input.postChannel,
        propertyTypeId: input.propertyTypeId,
        monthlyFees: new Prisma.Decimal(input.monthlyFees),
        depositAmount: new Prisma.Decimal(input.depositAmount),
        contractTypeId: input.contractTypeId,
        areaSize: input.areaSize,
        floorLevelId: input.floorLevelId,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        houseRules: input.houseRules,
        contactTelegram: input.contactTelegram,
        contactViber: input.contactViber,
        contactPhoneNumber: input.contactPhoneNumber,
        cityId: input.cityId,
        stateId: input.stateId,
        streetAddress: input.streetAddress,
        latitude: toOptionalDecimal(input.latitude),
        longitude: toOptionalDecimal(input.longitude),
        nearbyPlaces: input.nearbyPlaces,
        availability: input.availability,
        images: {
          create: input.imagePaths.map((imagePath, index) => ({
            imagePath,
            sortOrder: index + 1
          }))
        },
        amenities: {
          create: input.amenityIds.map((amenityId) => ({
            amenityId
          }))
        }
      },
      include: HOUSE_OWNER_INCLUDE
    });

    // Counted against the monthly listing allowance even if the listing is deleted later.
    await tx.auditLog.create({ data: { actorUserId: userId, action: LISTING_CREATED_ACTION, targetType: 'House', targetId: created.id } });

    return created;
  }, LOCKED_TRANSACTION_OPTIONS);

  return normalizeHouse(house);
};

export const listAgentHouses = async (userId: string) => {
  const houses = await prisma.house.findMany({
    where: {
      agentId: userId
    },
    include: HOUSE_OWNER_INCLUDE,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return houses.map(normalizeHouse);
};

export const updateAgentHouse = async (userId: string, houseId: string, input: AgentHouseInput) => {
  await assertVerifiedAgent(userId);

  const existing = await prisma.house.findUnique({
    where: {
      id: houseId
    },
    select: {
      id: true,
      agentId: true
    }
  });

  if (!existing) {
    throw new ApiError(404, 'HOUSE_NOT_FOUND', 'House not found.');
  }

  if (existing.agentId !== userId) {
    throw new ApiError(403, 'HOUSE_FORBIDDEN', 'You can only update your own houses.');
  }

  const house = await prisma.$transaction(async (tx) => {
    await tx.houseImage.deleteMany({ where: { houseId } });
    await tx.houseAmenity.deleteMany({ where: { houseId } });

    return tx.house.update({
      where: {
        id: houseId
      },
      data: {
        title: input.title,
        description: input.description,
        postChannel: input.postChannel,
        propertyTypeId: input.propertyTypeId,
        monthlyFees: new Prisma.Decimal(input.monthlyFees),
        depositAmount: new Prisma.Decimal(input.depositAmount),
        contractTypeId: input.contractTypeId,
        areaSize: input.areaSize,
        floorLevelId: input.floorLevelId,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        houseRules: input.houseRules,
        contactTelegram: input.contactTelegram,
        contactViber: input.contactViber,
        contactPhoneNumber: input.contactPhoneNumber,
        cityId: input.cityId,
        stateId: input.stateId,
        streetAddress: input.streetAddress,
        latitude: toOptionalDecimal(input.latitude),
        longitude: toOptionalDecimal(input.longitude),
        nearbyPlaces: input.nearbyPlaces,
        availability: input.availability,
        images: {
          create: input.imagePaths.map((imagePath, index) => ({
            imagePath,
            sortOrder: index + 1
          }))
        },
        amenities: {
          create: input.amenityIds.map((amenityId) => ({
            amenityId
          }))
        }
      },
      include: HOUSE_OWNER_INCLUDE
    });
  });

  if (house.availability !== 'AVAILABLE') {
    await cancelBoostsForHouse(house.id, 'listing no longer available');
  }

  return normalizeHouse(house);
};

export const deleteAgentHouse = async (userId: string, houseId: string) => {
  await assertVerifiedAgent(userId);

  const existing = await prisma.house.findUnique({
    where: {
      id: houseId
    },
    select: {
      id: true,
      agentId: true
    }
  });

  if (!existing) {
    throw new ApiError(404, 'HOUSE_NOT_FOUND', 'House not found.');
  }

  if (existing.agentId !== userId) {
    throw new ApiError(403, 'HOUSE_FORBIDDEN', 'You can only delete your own houses.');
  }

  await prisma.house.delete({
    where: {
      id: houseId
    }
  });
};
