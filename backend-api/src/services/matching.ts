/**
 * Compatibility scoring for houses, roommates and potential tenants.
 *
 * Every score is a weighted average of normalised factor scores (0..1). A factor that
 * cannot be judged because the information was never given is left out of the average
 * rather than counted as a match, and lowers the confidence of the result instead.
 * The percentage describes how well the stated requirements line up; it is not a
 * statistically validated probability that a tenancy will work out.
 */

export type FactorStatus = 'match' | 'partial' | 'conflict' | 'unknown';
export type MatchConfidence = 'HIGH' | 'LOW' | 'INCOMPLETE';

export interface FactorResult {
  key: string;
  status: FactorStatus;
  /** Share of the final score this factor could contribute, out of 100. */
  weight: number;
}

export interface MatchResult {
  /** 0-100. */
  score: number;
  confidence: MatchConfidence;
  factors: FactorResult[];
  /** Factor keys that matched, strongest contribution first. */
  matched: string[];
  conflicts: string[];
  /** Factor keys that could not be judged for lack of information. */
  missing: string[];
}

/** Weights for matching a house to a person. Tune here; they need not add up to 100. */
export const HOUSE_MATCH_WEIGHTS = {
  budget: 25,
  location: 20,
  preferences: 20,
  room: 10,
  amenities: 10,
  lease: 10,
  occupation: 5
} as const;

/** Weights for matching two people as roommates: lifestyle first, occupation last. */
export const ROOMMATE_MATCH_WEIGHTS = {
  budget: 20,
  location: 15,
  smoking: 10,
  social: 10,
  noise: 10,
  sleep: 10,
  cleanliness: 10,
  occupation: 5,
  guests: 4,
  chores: 3,
  timing: 3
} as const;

/** Below this share of judged weight a result is labelled low confidence. */
const LOW_CONFIDENCE_BELOW = 50;
/** A rent this far above the stated maximum is a partial fit; beyond it, a conflict. */
const BUDGET_TOLERANCE = 0.1;
/** An essential requirement that fails caps the score, whatever else matches. */
const BUDGET_CONFLICT_CAP = 45;
const LOCATION_CONFLICT_FACTOR = 0.8;

export interface PersonPreferences {
  budgetMin: number | null;
  budgetMax: number | null;
  preferredCityId: string | null;
  preferredStateId: string | null;
  propertyTypeId: string | null;
  bedroomsMin: number | null;
  wantsFurnished: boolean | null;
  needsInternet: boolean | null;
  needsQuiet: boolean | null;
  amenityIds: string[];
  moveInDate: Date | null;
  leaseMonths: number | null;
  roomArrangement: string | null;
  cleanliness: string | null;
  sleepSchedule: string | null;
  smoking: string | null;
  noiseTolerance: string | null;
  socialLevel: string | null;
  guests: string | null;
  sharesChores: boolean | null;
}

export interface PersonFacts {
  occupationId: string | null;
  occupationName: string | null;
  preferences: PersonPreferences | null;
}

export interface HouseFacts {
  monthlyFees: number;
  cityId: string;
  stateId: string;
  propertyTypeId: string;
  bedrooms: number;
  amenityIds: string[];
  /** Upper-cased amenity names, e.g. WIFI, FURNISHED. */
  amenityNames: string[];
  contractMonths: number | null;
  /** Free text the agent wrote about the surroundings. */
  nearbyText: string;
}

export interface RoommateFacts {
  occupationId: string | null;
  cityId: string | null;
  stateId: string | null;
  /** Monthly share parsed from the post, when it could be read as a number. */
  budget: number | null;
  isSmokingFriendly: boolean;
  isNoSmoking: boolean;
  likesNightOut: boolean;
  likesHangoutEveryday: boolean;
  hobbyChillWithOthers: boolean;
  hobbyRelaxSilent: boolean;
  hobbySinging: boolean;
  /** The poster's own stated preferences, when they filled them in. */
  preferences: PersonPreferences | null;
}

type Scored = number | null;

const average = (values: Scored[]): Scored => {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
};

const statusOf = (score: Scored): FactorStatus => {
  if (score === null) return 'unknown';
  if (score >= 0.85) return 'match';
  if (score >= 0.4) return 'partial';
  return 'conflict';
};

const finish = (
  scores: Record<string, Scored>,
  weights: Record<string, number>,
  options: { hasProfile: boolean; adjust?: (score: number, statuses: Record<string, FactorStatus>) => number }
): MatchResult => {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let judgedWeight = 0;
  let earned = 0;
  const statuses: Record<string, FactorStatus> = {};
  const factors: FactorResult[] = [];

  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key] ?? null;
    statuses[key] = statusOf(score);
    factors.push({ key, status: statuses[key], weight: Math.round((weight / totalWeight) * 100) });
    if (score !== null) {
      judgedWeight += weight;
      earned += weight * score;
    }
  }

  const raw = judgedWeight === 0 ? 0 : (earned / judgedWeight) * 100;
  const score = Math.max(0, Math.min(100, Math.round(options.adjust ? options.adjust(raw, statuses) : raw)));
  const judgedShare = (judgedWeight / totalWeight) * 100;
  const byWeight = (a: FactorResult, b: FactorResult) => b.weight - a.weight;

  return {
    score,
    confidence: !options.hasProfile || judgedWeight === 0 ? 'INCOMPLETE' : judgedShare < LOW_CONFIDENCE_BELOW ? 'LOW' : 'HIGH',
    factors,
    matched: factors.filter((factor) => factor.status === 'match').sort(byWeight).map((factor) => factor.key),
    conflicts: factors.filter((factor) => factor.status === 'conflict').sort(byWeight).map((factor) => factor.key),
    missing: factors.filter((factor) => factor.status === 'unknown').map((factor) => factor.key)
  };
};

const budgetScore = (price: number | null, budgetMin: number | null, budgetMax: number | null): Scored => {
  if (price === null || budgetMax === null) return null;
  if (price <= budgetMax) {
    // Far below the stated range is still affordable, just not what was asked for.
    return budgetMin !== null && price < budgetMin * 0.5 ? 0.7 : 1;
  }
  return price <= budgetMax * (1 + BUDGET_TOLERANCE) ? 0.5 : 0;
};

const locationScore = (cityId: string | null, stateId: string | null, preferences: PersonPreferences | null): Scored => {
  if (!preferences?.preferredCityId || !cityId) return null;
  if (preferences.preferredCityId === cityId) return 1;
  return preferences.preferredStateId && preferences.preferredStateId === stateId ? 0.5 : 0;
};

const has = (house: HouseFacts, ...names: string[]): boolean => names.some((name) => house.amenityNames.includes(name));
const mentions = (house: HouseFacts, ...words: string[]): boolean => words.some((word) => house.nearbyText.includes(word));

const SECURITY_AMENITIES = ['CCTV', 'SECURITY GUARD', 'FINGERPRINT', 'KEYCARD'];

/**
 * What an occupation usually makes useful. It only ever supplies a small share of the score:
 * a person's own stated preferences always weigh far more than their job title.
 */
const occupationScore = (occupationName: string | null, house: HouseFacts, medianRent: number | null): Scored => {
  if (!occupationName) return null;
  const name = occupationName.toLowerCase();
  const affordable = medianRent === null ? null : house.monthlyFees <= medianRent ? 1 : 0.3;
  const secure = has(house, ...SECURITY_AMENITIES) ? 1 : 0.3;

  if (name.includes('student')) {
    return average([affordable, mentions(house, 'universit', 'college', 'school', 'campus', 'bus') ? 1 : 0.4]);
  }
  if (name.includes('remote') || name.includes('software') || name.includes('it ')) {
    return (has(house, 'WIFI') ? 0.6 : 0) + (has(house, 'DESK') ? 0.4 : 0);
  }
  if (name.includes('health')) {
    return average([secure, mentions(house, 'hospital', 'clinic') ? 1 : 0.4]);
  }
  if (name.includes('teacher') || name.includes('educator')) {
    return average([secure, mentions(house, 'school', 'universit', 'college') ? 1 : 0.4]);
  }
  if (name.includes('engineer') || name.includes('worker')) {
    return average([affordable, has(house, 'PARKING') || mentions(house, 'bus', 'station', 'industrial') ? 1 : 0.4]);
  }
  return null;
};

const DAY_MS = 86_400_000;

export const scoreHouseForPerson = (
  house: HouseFacts,
  person: PersonFacts,
  context: { medianRent: number | null; now?: Date } = { medianRent: null }
): MatchResult => {
  const preferences = person.preferences;
  const now = context.now ?? new Date();

  const stated: Scored[] = [];
  if (preferences?.wantsFurnished === true) stated.push(has(house, 'FURNISHED') ? 1 : 0);
  if (preferences && preferences.amenityIds.length > 0) {
    const found = preferences.amenityIds.filter((id) => house.amenityIds.includes(id)).length;
    stated.push(found / preferences.amenityIds.length);
  }
  // A quiet home cannot be read from a listing, so `needsQuiet` is never scored as a match here.

  const room: Scored[] = [];
  if (preferences?.propertyTypeId) room.push(preferences.propertyTypeId === house.propertyTypeId ? 1 : 0);
  if (preferences?.bedroomsMin != null) room.push(house.bedrooms >= preferences.bedroomsMin ? 1 : 0);

  const lease: Scored[] = [];
  if (preferences?.leaseMonths != null && house.contractMonths !== null) {
    lease.push(house.contractMonths <= preferences.leaseMonths ? 1 : 0.3);
  }
  if (preferences?.moveInDate) {
    // A listed house is available now; a move planned far ahead fits less well.
    lease.push(preferences.moveInDate.getTime() - now.getTime() <= 60 * DAY_MS ? 1 : 0.6);
  }

  return finish(
    {
      budget: budgetScore(house.monthlyFees, preferences?.budgetMin ?? null, preferences?.budgetMax ?? null),
      location: locationScore(house.cityId, house.stateId, preferences),
      preferences: average(stated),
      room: average(room),
      amenities: preferences?.needsInternet === true ? (has(house, 'WIFI') ? 1 : 0) : null,
      lease: average(lease),
      occupation: occupationScore(person.occupationName, house, context.medianRent)
    },
    HOUSE_MATCH_WEIGHTS,
    {
      hasProfile: Boolean(preferences),
      adjust: (score, statuses) => {
        let adjusted = score;
        if (statuses.location === 'conflict') adjusted *= LOCATION_CONFLICT_FACTOR;
        if (statuses.budget === 'conflict') adjusted = Math.min(adjusted, BUDGET_CONFLICT_CAP);
        return adjusted;
      }
    }
  );
};

/** Compares two ordered choices: equal is a match, neighbours a partial fit, opposites a conflict. */
const scaleScore = (scale: readonly string[], mine: string | null | undefined, theirs: string | null | undefined, flexible?: string): Scored => {
  if (!mine || !theirs) return null;
  if (flexible && (mine === flexible || theirs === flexible)) return 1;
  const a = scale.indexOf(mine);
  const b = scale.indexOf(theirs);
  if (a === -1 || b === -1) return null;
  const distance = Math.abs(a - b);
  return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
};

export const CLEANLINESS_LEVELS = ['RELAXED', 'TIDY', 'VERY_TIDY'] as const;
export const SLEEP_SCHEDULES = ['EARLY', 'FLEXIBLE', 'LATE'] as const;
export const SMOKING_CHOICES = ['NON_SMOKER', 'ANY', 'SMOKER'] as const;
export const NOISE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const SOCIAL_LEVELS = ['QUIET', 'BALANCED', 'SOCIAL'] as const;
export const GUEST_LEVELS = ['RARELY', 'SOMETIMES', 'OFTEN'] as const;
export const ROOM_ARRANGEMENTS = ['PRIVATE', 'ANY', 'SHARED'] as const;

const smokingScore = (mine: string | null | undefined, roommate: RoommateFacts): Scored => {
  if (!mine) return null;
  const theirs = roommate.isNoSmoking ? 'NON_SMOKER' : roommate.isSmokingFriendly ? 'SMOKER' : (roommate.preferences?.smoking ?? null);
  if (!theirs) return null;
  if (mine === 'ANY' || theirs === 'ANY') return 1;
  return mine === theirs ? 1 : 0;
};

const socialLevelOf = (roommate: RoommateFacts): string | null => {
  if (roommate.preferences?.socialLevel) return roommate.preferences.socialLevel;
  const social = roommate.likesNightOut || roommate.likesHangoutEveryday || roommate.hobbyChillWithOthers;
  if (social && roommate.hobbyRelaxSilent) return 'BALANCED';
  if (social) return 'SOCIAL';
  return roommate.hobbyRelaxSilent ? 'QUIET' : null;
};

/** How much noise the other person makes or accepts, read from their post. */
const noiseLevelOf = (roommate: RoommateFacts): string | null => {
  if (roommate.preferences?.noiseTolerance) return roommate.preferences.noiseTolerance;
  const loud = roommate.likesNightOut || roommate.likesHangoutEveryday || roommate.hobbySinging;
  if (loud && roommate.hobbyRelaxSilent) return 'MEDIUM';
  if (loud) return 'HIGH';
  return roommate.hobbyRelaxSilent ? 'LOW' : null;
};

const timingScore = (mine: PersonPreferences | null, theirs: PersonPreferences | null): Scored => {
  const parts: Scored[] = [];
  if (mine?.moveInDate && theirs?.moveInDate) {
    const days = Math.abs(mine.moveInDate.getTime() - theirs.moveInDate.getTime()) / DAY_MS;
    parts.push(days <= 45 ? 1 : days <= 90 ? 0.5 : 0);
  }
  if (mine?.leaseMonths != null && theirs?.leaseMonths != null) {
    parts.push(mine.leaseMonths === theirs.leaseMonths ? 1 : 0.4);
  }
  return average(parts);
};

export const scoreRoommateForPerson = (roommate: RoommateFacts, person: PersonFacts): MatchResult => {
  const mine = person.preferences;
  const theirs = roommate.preferences;

  return finish(
    {
      budget: budgetScore(roommate.budget, mine?.budgetMin ?? null, mine?.budgetMax ?? null),
      location: locationScore(roommate.cityId, roommate.stateId, mine),
      smoking: smokingScore(mine?.smoking, roommate),
      social: scaleScore(SOCIAL_LEVELS, mine?.socialLevel, socialLevelOf(roommate)),
      noise: scaleScore(NOISE_LEVELS, mine?.noiseTolerance, noiseLevelOf(roommate)),
      sleep: scaleScore(SLEEP_SCHEDULES, mine?.sleepSchedule, theirs?.sleepSchedule, 'FLEXIBLE'),
      cleanliness: scaleScore(CLEANLINESS_LEVELS, mine?.cleanliness, theirs?.cleanliness),
      // Sharing an occupation helps a little; a different one is never a conflict.
      occupation: person.occupationId && roommate.occupationId ? (person.occupationId === roommate.occupationId ? 1 : 0.5) : null,
      guests: scaleScore(GUEST_LEVELS, mine?.guests, theirs?.guests),
      chores: mine?.sharesChores != null && theirs?.sharesChores != null ? (mine.sharesChores === theirs.sharesChores ? 1 : 0) : null,
      timing: timingScore(mine, theirs)
    },
    ROOMMATE_MATCH_WEIGHTS,
    {
      hasProfile: Boolean(mine),
      adjust: (score, statuses) => {
        let adjusted = score;
        if (statuses.smoking === 'conflict') adjusted *= 0.75;
        if (statuses.budget === 'conflict') adjusted = Math.min(adjusted, BUDGET_CONFLICT_CAP);
        return adjusted;
      }
    }
  );
};

/** Reads a monthly amount out of free text such as "150,000 MMK" or "1.5 lakh". */
export const parseMonthlyAmount = (text: string | null | undefined): number | null => {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  let amount = Number(match[0]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/lakh|သိန်း/i.test(text)) amount *= 100_000;
  else if (/\d\s*k\b/i.test(text)) amount *= 1_000;
  return Math.round(amount);
};

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? null;
  const lower = sorted[middle - 1] ?? upper;
  return upper === null || lower === null ? null : sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
};
