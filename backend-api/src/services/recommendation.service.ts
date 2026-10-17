import { HouseAvailabilityStatus, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { OCCUPATION_FACTOR_WEIGHTS, OCCUPATION_MIN_JUDGED_SHARE, scoreOccupations } from './occupation-compatibility';
import { ApiError } from '../utils/api-error';
import {
  HouseFacts,
  ListingFacts,
  MatchResult,
  PersonFacts,
  PersonPreferences,
  TENANT_MATCH_THRESHOLDS,
  TENANT_MATCH_WEIGHTS,
  TenantFacts,
  TenantFactor,
  median,
  parseMonthlyAmount,
  scoreHouseForPerson,
  scoreListingForTenant,
  scoreRoommateForPerson,
  tierOf
} from './matching';

/** Most records scored for one request. Newest first, so the cap only trims old entries. */
const CANDIDATE_LIMIT = 300;
/** A house scoring below this is not presented as a recommendation. */
const MIN_HOUSE_SCORE = 40;
const DEFAULT_HOUSE_RECOMMENDATIONS = 5;

export const PREFERENCE_INCLUDE = {
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

/** What the roommate scoring needs to know about one post. */
export interface RoommatePostForMatch {
  occupationId: string | null;
  budgetCostSharing: string;
  isSmokingFriendly: boolean;
  isNoSmoking: boolean;
  likesNightOut: boolean;
  likesHangoutEveryday: boolean;
  hobbyChillWithOthers: boolean;
  hobbyRelaxSilent: boolean;
  hobbySinging: boolean;
  house: { cityId: string | null; stateId: string | null };
  user: { housingPreference?: PreferenceRow | null };
}

/** The signed-in person as the scoring sees them; null when the account no longer exists. */
export const loadViewerFacts = async (userId: string): Promise<{ person: PersonFacts; hasPreferences: boolean } | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { occupation: { select: { id: true, name: true } }, housingPreference: { include: PREFERENCE_INCLUDE } }
  });
  return user ? { person: toPersonFacts(user), hasPreferences: Boolean(user.housingPreference) } : null;
};

/** Compatibility between one roommate post and one person, from what both actually stated. */
export const matchRoommatePost = (post: RoommatePostForMatch, person: PersonFacts) =>
  presentMatch(
    scoreRoommateForPerson(
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
  );

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
    .map((post) => ({ post, match: matchRoommatePost(post, person) }))
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
      match
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
  houseRules?: string | null;
}

const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

/**
 * How well a listing (as currently typed in the form, not yet saved) suits the people who chose
 * to be suggested to housing agents. Every consenting profile is scored, including people whose
 * budget the rent exceeds (they score low rather than disappearing); profiles with too little
 * information are counted as insufficient instead of being given a misleading score.
 *
 * Privacy: only people with `visibleToAgents` are considered, and only what that setting promises
 * leaves this function (name, photo, occupation and their housing requirements). E-mail, phone
 * and address never do. The route itself is limited to signed-in agents.
 */
export const matchTenantsForListing = async (agentId: string, draft: ListingDraftInput, page = 1, pageSize = 5, now = new Date()) => {
  const [allAmenities, contractType] = await Promise.all([
    // A short master list; used to read both the listing's and the tenants' amenity ids.
    prisma.amenity.findMany({ select: { id: true, name: true } }),
    draft.contractTypeId
      ? prisma.contractType.findUnique({ where: { id: draft.contractTypeId }, select: { durationMonths: true } })
      : Promise.resolve(null)
  ]);
  const amenityName = new Map(allAmenities.map((item) => [item.id, item.name.toUpperCase()]));
  const listingAmenityIds = draft.amenityIds.filter((id) => amenityName.has(id));

  const listing: ListingFacts = {
    monthlyFees: draft.monthlyFees,
    cityId: draft.cityId,
    stateId: draft.stateId,
    propertyTypeId: draft.propertyTypeId,
    bedrooms: draft.bedrooms,
    amenityIds: listingAmenityIds,
    amenityNames: listingAmenityIds.map((id) => amenityName.get(id) as string),
    contractMonths: contractType?.durationMonths ?? null,
    nearbyText: `${draft.nearbyPlaces ?? ''} ${draft.description ?? ''}`.toLowerCase(),
    rulesText: draft.houseRules ?? ''
  };

  const people = await prisma.user.findMany({
    where: { id: { not: agentId }, isActive: true, housingPreference: { is: { visibleToAgents: true } } },
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

  const evaluated = people.map((person) => {
    const facts: TenantFacts = {
      ...toPersonFacts(person),
      requiredAmenityNames: (person.housingPreference?.amenityIds ?? []).flatMap((id) => amenityName.get(id) ?? [])
    };
    return { person, match: scoreListingForTenant(listing, facts, now) };
  });

  const scored = evaluated
    .filter(({ match }) => match.confidence !== 'INCOMPLETE')
    .sort((a, b) => b.match.score - a.match.score || a.person.id.localeCompare(b.person.id));
  const insufficient = evaluated.length - scored.length;
  const scores = scored.map(({ match }) => match.score);

  // Per factor, how many scored profiles it matched, partly matched, conflicted with, or could not judge.
  const factorSummary = (Object.keys(TENANT_MATCH_WEIGHTS) as TenantFactor[]).map((key) => {
    const counts = { match: 0, partial: 0, conflict: 0, unknown: 0 };
    for (const { match } of scored) {
      const status = match.factors.find((factor) => factor.key === key)?.status ?? 'unknown';
      counts[status] += 1;
    }
    return { key, weight: TENANT_MATCH_WEIGHTS[key], ...counts };
  });

  const start = (page - 1) * pageSize;
  return {
    /** The draft is scored as typed; nothing is saved by this request. */
    basis: 'DRAFT' as const,
    evaluated: evaluated.length,
    insufficient,
    scoredCount: scored.length,
    overallScore: average(scores),
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    strongMatches: scored.filter(({ match }) => match.score >= TENANT_MATCH_THRESHOLDS.strong && match.confidence === 'HIGH').length,
    tiers: {
      HIGH: scores.filter((score) => tierOf(score) === 'HIGH').length,
      MEDIUM: scores.filter((score) => tierOf(score) === 'MEDIUM').length,
      LOW: scores.filter((score) => tierOf(score) === 'LOW').length
    },
    factorSummary,
    method: { weights: TENANT_MATCH_WEIGHTS, thresholds: TENANT_MATCH_THRESHOLDS },
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
      match: {
        ...presentMatch(match),
        tier: tierOf(match.score),
        factors: match.factors,
        reasons: match.reasons
      }
    }))
  };
};

export interface OccupationDraftInput {
  monthlyFees: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSize: string | null;
  amenityIds: string[];
  nearbyPlaces: string | null;
  description: string | null;
  houseRules: string | null;
}

/**
 * Compatibility of the listing as typed (unsaved form values) with every active occupation
 * category. Needs no tenant records; the only database reads are the occupation list, the
 * amenity names and the typical rent of available listings used for affordability.
 */
export const occupationCompatibilityForListing = async (draft: OccupationDraftInput) => {
  const [occupations, amenities, rents] = await Promise.all([
    prisma.occupation.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    draft.amenityIds.length > 0 ? prisma.amenity.findMany({ where: { id: { in: draft.amenityIds } }, select: { name: true } }) : Promise.resolve([]),
    prisma.house.findMany({
      where: { availability: HouseAvailabilityStatus.AVAILABLE },
      select: { monthlyFees: true },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_LIMIT
    })
  ]);
  const typicalRent = median(rents.map((item) => Number(item.monthlyFees)));

  const items = scoreOccupations(occupations, {
    monthlyFees: draft.monthlyFees,
    typicalRent,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    areaSize: draft.areaSize,
    amenityNames: amenities.map((item) => item.name.toUpperCase()),
    accessText: `${draft.nearbyPlaces ?? ''} ${draft.description ?? ''}`.toLowerCase(),
    houseRules: draft.houseRules ?? ''
  });

  return {
    basis: 'DRAFT' as const,
    typicalRent,
    method: { weights: OCCUPATION_FACTOR_WEIGHTS, minJudgedShare: OCCUPATION_MIN_JUDGED_SHARE },
    items
  };
};
