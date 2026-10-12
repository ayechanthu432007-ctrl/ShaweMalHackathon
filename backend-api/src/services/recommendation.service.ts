import { HouseAvailabilityStatus, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import {
  HouseFacts,
  MatchResult,
  PersonFacts,
  PersonPreferences,
  median,
  parseMonthlyAmount,
  scoreHouseForPerson,
  scoreRoommateForPerson
} from './matching';

/** Most records scored for one request. Newest first, so the cap only trims old entries. */
const CANDIDATE_LIMIT = 300;
/** A house scoring below this is not presented as a recommendation. */
const MIN_HOUSE_SCORE = 40;
const DEFAULT_HOUSE_RECOMMENDATIONS = 5;

const PREFERENCE_INCLUDE = {
  preferredCity: { select: { id: true, name: true, stateId: true } },
  propertyType: { select: { id: true, name: true } }
} as const;

type PreferenceRow = Prisma.HousingPreferenceGetPayload<{ include: typeof PREFERENCE_INCLUDE }>;

const toPersonPreferences = (row: PreferenceRow | null | undefined): PersonPreferences | null =>
  row
    ? {
        budgetMin: row.budgetMin,
        budgetMax: row.budgetMax,
        preferredCityId: row.preferredCityId,
        preferredStateId: row.preferredCity?.stateId ?? null,
        propertyTypeId: row.propertyTypeId,
        bedroomsMin: row.bedroomsMin,
        wantsFurnished: row.wantsFurnished,
        needsInternet: row.needsInternet,
        needsQuiet: row.needsQuiet,
        amenityIds: row.amenityIds ?? [],
        moveInDate: row.moveInDate,
        leaseMonths: row.leaseMonths,
        roomArrangement: row.roomArrangement,
        cleanliness: row.cleanliness,
        sleepSchedule: row.sleepSchedule,
        smoking: row.smoking,
        noiseTolerance: row.noiseTolerance,
        socialLevel: row.socialLevel,
        guests: row.guests,
        sharesChores: row.sharesChores
      }
    : null;

const serializePreferences = (row: PreferenceRow | null, occupation: { id: string; name: string } | null) => ({
  occupation,
  preferences: row
    ? {
        budgetMin: row.budgetMin,
        budgetMax: row.budgetMax,
        preferredCity: row.preferredCity ? { id: row.preferredCity.id, name: row.preferredCity.name } : null,
        propertyType: row.propertyType,
        bedroomsMin: row.bedroomsMin,
        wantsFurnished: row.wantsFurnished,
        needsInternet: row.needsInternet,
        needsQuiet: row.needsQuiet,
        amenityIds: row.amenityIds ?? [],
        moveInDate: row.moveInDate,
        leaseMonths: row.leaseMonths,
        roomArrangement: row.roomArrangement,
        cleanliness: row.cleanliness,
        sleepSchedule: row.sleepSchedule,
        smoking: row.smoking,
        noiseTolerance: row.noiseTolerance,
        socialLevel: row.socialLevel,
        guests: row.guests,
        sharesChores: row.sharesChores,
        visibleToAgents: row.visibleToAgents
      }
    : null
});

const loadPerson = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      occupation: { select: { id: true, name: true } },
      housingPreference: { include: PREFERENCE_INCLUDE }
    }
  });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return user;
};

const toPersonFacts = (user: { occupation: { id: string; name: string } | null; housingPreference: PreferenceRow | null }): PersonFacts => ({
  occupationId: user.occupation?.id ?? null,
  occupationName: user.occupation?.name ?? null,
  preferences: toPersonPreferences(user.housingPreference)
});

export const getHousingPreferences = async (userId: string) => {
  const user = await loadPerson(userId);
  return serializePreferences(user.housingPreference, user.occupation);
};

export interface HousingPreferencesInput {
  occupationId?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredCityId?: string | null;
  propertyTypeId?: string | null;
  bedroomsMin?: number | null;
  wantsFurnished?: boolean | null;
  needsInternet?: boolean | null;
  needsQuiet?: boolean | null;
  amenityIds?: string[];
  moveInDate?: Date | null;
  leaseMonths?: number | null;
  roomArrangement?: string | null;
  cleanliness?: string | null;
  sleepSchedule?: string | null;
  smoking?: string | null;
  noiseTolerance?: string | null;
  socialLevel?: string | null;
  guests?: string | null;
  sharesChores?: boolean | null;
  visibleToAgents?: boolean;
}

const assertActive = async (
  kind: 'occupation' | 'city' | 'propertyType',
  id: string | null | undefined,
  code: string,
  label: string
): Promise<void> => {
  if (!id) return;
  const where = { id, isActive: true };
  const found =
    kind === 'occupation'
      ? await prisma.occupation.findFirst({ where, select: { id: true } })
      : kind === 'city'
        ? await prisma.city.findFirst({ where, select: { id: true } })
        : await prisma.propertyType.findFirst({ where, select: { id: true } });
  if (!found) {
    throw new ApiError(400, code, `${label} is not valid.`);
  }
};

export const assertOccupation = (occupationId: string) => assertActive('occupation', occupationId, 'OCCUPATION_INVALID', 'Occupation');

export const saveHousingPreferences = async (userId: string, input: HousingPreferencesInput) => {
  const { occupationId, ...preferences } = input;
  if (preferences.budgetMin != null && preferences.budgetMax != null && preferences.budgetMin > preferences.budgetMax) {
    throw new ApiError(400, 'BUDGET_RANGE_INVALID', 'Minimum budget cannot be higher than maximum budget.');
  }
  await assertActive('occupation', occupationId, 'OCCUPATION_INVALID', 'Occupation');
  await assertActive('city', preferences.preferredCityId, 'CITY_INVALID', 'Preferred city');
  await assertActive('propertyType', preferences.propertyTypeId, 'PROPERTY_TYPE_INVALID', 'Property type');

  await prisma.$transaction(async (tx) => {
    if (occupationId !== undefined) {
      await tx.user.update({ where: { id: userId }, data: { occupationId } });
    }
    await tx.housingPreference.upsert({ where: { userId }, create: { userId, ...preferences }, update: preferences });
  });

  return getHousingPreferences(userId);
};

const HOUSE_MATCH_INCLUDE = {
  images: { select: { imagePath: true, sortOrder: true }, orderBy: { sortOrder: 'asc' as const }, take: 1 },
  propertyType: { select: { id: true, name: true } },
  contractType: { select: { id: true, name: true, durationMonths: true } },
  city: { select: { id: true, name: true } },
  state: { select: { id: true, name: true } },
  amenities: { select: { amenity: { select: { id: true, name: true } } } }
} as const;

type HouseRow = Prisma.HouseGetPayload<{ include: typeof HOUSE_MATCH_INCLUDE }>;

const toHouseFacts = (house: HouseRow): HouseFacts => ({
  monthlyFees: Number(house.monthlyFees),
  cityId: house.cityId,
  stateId: house.stateId,
  propertyTypeId: house.propertyTypeId,
  bedrooms: house.bedrooms,
  amenityIds: house.amenities.map((item) => item.amenity.id),
  amenityNames: house.amenities.map((item) => item.amenity.name.toUpperCase()),
  contractMonths: house.contractType?.durationMonths ?? null,
  nearbyText: `${house.nearbyPlaces ?? ''} ${house.description ?? ''}`.toLowerCase()
});

const presentMatch = (match: MatchResult) => ({
  score: match.score,
  confidence: match.confidence,
  matched: match.matched,
  conflicts: match.conflicts,
  missing: match.missing
});

/**
 * The houses that best fit the signed-in person, best first. Only listings that are
 * available right now are considered, and a listing posted twice is shown once.
 */
export const recommendHouses = async (userId: string, limit = DEFAULT_HOUSE_RECOMMENDATIONS) => {
  const user = await loadPerson(userId);
  const person = toPersonFacts(user);
  const budgetMax = person.preferences?.budgetMax ?? null;

  const houses = await prisma.house.findMany({
    where: {
      availability: HouseAvailabilityStatus.AVAILABLE,
      agentId: { not: userId },
      // Far outside the stated maximum can never be recommended, so it is not loaded at all.
      ...(budgetMax !== null ? { monthlyFees: { lte: budgetMax * 1.1 } } : {})
    },
    include: HOUSE_MATCH_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: CANDIDATE_LIMIT
  });

  const medianRent = median(houses.map((house) => Number(house.monthlyFees)));
  const seen = new Set<string>();
  const scored = [];
  for (const house of houses) {
    const duplicateKey = `${house.agentId}|${house.title.trim().toLowerCase()}|${house.monthlyFees.toString()}|${house.cityId}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);

    const match = scoreHouseForPerson(toHouseFacts(house), person, { medianRent });
    if (match.score < MIN_HOUSE_SCORE || match.conflicts.includes('budget')) continue;
    scored.push({ house, match });
  }
  scored.sort((a, b) => b.match.score - a.match.score || b.house.createdAt.getTime() - a.house.createdAt.getTime());

  return {
    userName: user.name,
    hasPreferences: Boolean(user.housingPreference),
    hasOccupation: Boolean(user.occupation),
    items: scored.slice(0, limit).map(({ house, match }) => ({
      house: {
        id: house.id,
        title: house.title,
        availability: house.availability,
        monthlyFees: Number(house.monthlyFees),
        bedrooms: house.bedrooms,
        bathrooms: house.bathrooms,
        propertyType: house.propertyType,
        city: house.city,
        state: house.state,
        thumbnail: house.images[0]?.imagePath ?? null,
        amenities: house.amenities.map((item) => item.amenity.name)
      },
      match: presentMatch(match)
    }))
  };
};

const ROOMMATE_MATCH_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      phone: true,
      profilePicturePath: true,
      housingPreference: { include: PREFERENCE_INCLUDE }
    }
  },
  occupation: { select: { id: true, name: true } },
  house: {
    select: { id: true, title: true, cityId: true, stateId: true, city: { select: { id: true, name: true } }, state: { select: { id: true, name: true } } }
  }
} as const;

/** Roommate posts ranked for the signed-in person, most compatible first. */
export const recommendRoommates = async (userId: string, page = 1, pageSize = 6) => {
  const user = await loadPerson(userId);
  const person = toPersonFacts(user);

  const posts = await prisma.roommatePost.findMany({
    where: { userId: { not: userId }, user: { isActive: true } },
    include: ROOMMATE_MATCH_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: CANDIDATE_LIMIT
  });

  const scored = posts
    .map((post) => ({
      post,
      match: scoreRoommateForPerson(
        {
          occupationId: post.occupationId,
          cityId: post.house.cityId,
          stateId: post.house.stateId,
          budget: parseMonthlyAmount(post.budgetCostSharing),
          isSmokingFriendly: post.isSmokingFriendly,
          isNoSmoking: post.isNoSmoking,
          likesNightOut: post.likesNightOut,
          likesHangoutEveryday: post.likesHangoutEveryday,
          hobbyChillWithOthers: post.hobbyChillWithOthers,
          hobbyRelaxSilent: post.hobbyRelaxSilent,
          hobbySinging: post.hobbySinging,
          preferences: toPersonPreferences(post.user.housingPreference)
        },
        person
      )
    }))
    .sort((a, b) => b.match.score - a.match.score || b.post.createdAt.getTime() - a.post.createdAt.getTime());

  const start = (page - 1) * pageSize;
  return {
    userName: user.name,
    hasPreferences: Boolean(user.housingPreference),
    total: scored.length,
    page,
    pageSize,
    items: scored.slice(start, start + pageSize).map(({ post, match }) => ({
      post: {
        id: post.id,
        title: post.title,
        budgetCostSharing: post.budgetCostSharing,
        gender: post.gender,
        occupation: post.occupation,
        photos: post.photoPaths ?? [],
        // The same contact details the public roommate list already shows.
        user: { id: post.user.id, name: post.user.name, phone: post.user.phone, profilePicturePath: post.user.profilePicturePath },
        house: { id: post.house.id, title: post.house.title, city: post.house.city, state: post.house.state }
      },
      match: presentMatch(match)
    }))
  };
};

export interface ListingDraftInput {
  monthlyFees: number;
  cityId: string;
  stateId: string;
  propertyTypeId: string;
  contractTypeId?: string | null;
  bedrooms: number;
  amenityIds: string[];
  nearbyPlaces?: string | null;
  description?: string | null;
}

/**
 * People a listing would suit, for the agent writing it. Only people who chose to be
 * suggested to agents are considered, and nothing that identifies or contacts them
 * (e-mail, phone, address) leaves this function.
 */
export const matchTenantsForListing = async (agentId: string, draft: ListingDraftInput, page = 1, pageSize = 5) => {
  const [amenities, contractType, rents] = await Promise.all([
    draft.amenityIds.length > 0
      ? prisma.amenity.findMany({ where: { id: { in: draft.amenityIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    draft.contractTypeId
      ? prisma.contractType.findUnique({ where: { id: draft.contractTypeId }, select: { durationMonths: true } })
      : Promise.resolve(null),
    prisma.house.findMany({
      where: { availability: HouseAvailabilityStatus.AVAILABLE },
      select: { monthlyFees: true },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_LIMIT
    })
  ]);

  const house: HouseFacts = {
    monthlyFees: draft.monthlyFees,
    cityId: draft.cityId,
    stateId: draft.stateId,
    propertyTypeId: draft.propertyTypeId,
    bedrooms: draft.bedrooms,
    amenityIds: amenities.map((item) => item.id),
    amenityNames: amenities.map((item) => item.name.toUpperCase()),
    contractMonths: contractType?.durationMonths ?? null,
    nearbyText: `${draft.nearbyPlaces ?? ''} ${draft.description ?? ''}`.toLowerCase()
  };
  const medianRent = median(rents.map((item) => Number(item.monthlyFees)));

  const people = await prisma.user.findMany({
    where: {
      id: { not: agentId },
      isActive: true,
      housingPreference: {
        is: {
          visibleToAgents: true,
          // Someone whose maximum is far below this rent cannot be a match.
          OR: [{ budgetMax: null }, { budgetMax: { gte: Math.floor(draft.monthlyFees / 1.1) } }]
        }
      }
    },
    select: {
      id: true,
      name: true,
      profilePicturePath: true,
      occupation: { select: { id: true, name: true } },
      housingPreference: { include: PREFERENCE_INCLUDE }
    },
    orderBy: { createdAt: 'desc' },
    take: CANDIDATE_LIMIT
  });

  const scored = people
    .map((person) => ({ person, match: scoreHouseForPerson(house, toPersonFacts(person), { medianRent }) }))
    .filter(({ match }) => match.confidence !== 'INCOMPLETE')
    .sort((a, b) => b.match.score - a.match.score);

  const start = (page - 1) * pageSize;
  return {
    total: scored.length,
    page,
    pageSize,
    items: scored.slice(start, start + pageSize).map(({ person, match }) => ({
      user: {
        id: person.id,
        name: person.name,
        profilePicturePath: person.profilePicturePath,
        occupation: person.occupation?.name ?? null
      },
      // What the person is looking for, as they chose to share it with agents.
      lookingFor: {
        preferredCity: person.housingPreference?.preferredCity?.name ?? null,
        budgetMin: person.housingPreference?.budgetMin ?? null,
        budgetMax: person.housingPreference?.budgetMax ?? null,
        bedroomsMin: person.housingPreference?.bedroomsMin ?? null,
        propertyType: person.housingPreference?.propertyType?.name ?? null,
        moveInDate: person.housingPreference?.moveInDate ?? null,
        leaseMonths: person.housingPreference?.leaseMonths ?? null
      },
      match: presentMatch(match)
    }))
  };
};
