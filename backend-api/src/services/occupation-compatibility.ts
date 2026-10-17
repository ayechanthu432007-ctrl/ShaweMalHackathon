/**
 * Listing → occupation-category compatibility, for agents writing or editing a listing.
 *
 * Each occupation category gets its own score from the listing as typed. The score is a weighted
 * average of five listing factors (each 0..1). Base weights are shared; an occupation's profile
 * only changes how much each factor matters and which amenities / nearby places are relevant to
 * typical housing needs of that category. These are relevance rules, not claims about any person:
 * nothing assumes income or personal circumstances. A factor the listing gives no information on
 * is left out of the average (never a free match) and reported as a missing detail.
 */

export const OCCUPATION_FACTOR_WEIGHTS = {
  affordability: 30,
  facilities: 25,
  location: 20,
  space: 15,
  rules: 10
} as const;

export type OccupationFactor = keyof typeof OCCUPATION_FACTOR_WEIGHTS;

export interface OccupationProfile {
  /** Multiplies the base weight of a factor (1 = neutral). */
  emphasis: Partial<Record<OccupationFactor, number>>;
  /** Amenities (upper-case names, as stored) that matter for this category. */
  amenities: string[];
  /** Words in Nearby places / Additional information that indicate convenient access. */
  accessWords: string[];
  /** Bedrooms that comfortably fit typical needs (e.g. a separate room for working). */
  bedrooms: number;
  /** Whether quiet-hours house rules are a plus (study or work from home). */
  valuesQuiet: boolean;
}

const TRANSPORT = ['bus', 'station', 'train', 'transport', 'highway', 'main road'];

/** Neutral profile, used for "Other" and for any occupation added later without its own rule. */
export const DEFAULT_OCCUPATION_PROFILE: OccupationProfile = {
  emphasis: {},
  amenities: ['WIFI', 'KITCHEN STOVE', 'WATER HEATER', 'REFRIGERATOR'],
  accessWords: [...TRANSPORT, 'market', 'shop', 'supermarket'],
  bedrooms: 1,
  valuesQuiet: false
};

/** Keyed by a normalised occupation name; edit here to tune. Unknown names use the default. */
export const OCCUPATION_PROFILES: Record<string, OccupationProfile> = {
  student: {
    emphasis: { affordability: 1.5, facilities: 1.2, location: 1.2, space: 0.6 },
    amenities: ['WIFI', 'FURNISHED', 'DESK', 'LAUNDRY'],
    accessWords: ['universit', 'college', 'school', 'campus', ...TRANSPORT],
    bedrooms: 1,
    valuesQuiet: true
  },
  'software / it professional': {
    emphasis: { facilities: 1.5, space: 1.2, location: 0.7 },
    amenities: ['WIFI', 'DESK', 'AIR CONDITIONER', 'FURNISHED'],
    accessWords: ['office', 'business', 'tech', ...TRANSPORT],
    bedrooms: 2,
    valuesQuiet: true
  },
  'remote worker': {
    emphasis: { facilities: 1.6, space: 1.3, rules: 1.3, location: 0.5 },
    amenities: ['WIFI', 'DESK', 'AIR CONDITIONER'],
    accessWords: ['quiet', 'cafe', 'coworking', 'park'],
    bedrooms: 2,
    valuesQuiet: true
  },
  'healthcare professional': {
    emphasis: { location: 1.5, facilities: 1.1 },
    amenities: ['WATER HEATER', 'LAUNDRY', 'SECURITY GUARD', 'CCTV'],
    accessWords: ['hospital', 'clinic', 'medical', ...TRANSPORT],
    bedrooms: 1,
    valuesQuiet: false
  },
  'teacher / educator': {
    emphasis: { affordability: 1.2, location: 1.2 },
    amenities: ['WIFI', 'DESK', 'KITCHEN STOVE', 'WATER HEATER'],
    accessWords: ['school', 'universit', 'college', ...TRANSPORT],
    bedrooms: 1,
    valuesQuiet: true
  },
  engineer: {
    emphasis: { location: 1.2, facilities: 1.1 },
    amenities: ['PARKING', 'WIFI', 'AIR CONDITIONER', 'WATER HEATER'],
    accessWords: ['industrial', 'factory', 'zone', 'site', ...TRANSPORT],
    bedrooms: 1,
    valuesQuiet: false
  },
  'general worker': {
    emphasis: { affordability: 1.5, location: 1.3, facilities: 0.8 },
    amenities: ['KITCHEN STOVE', 'FAN', 'LAUNDRY', 'WATER HEATER'],
    accessWords: ['factory', 'industrial', 'market', ...TRANSPORT],
    bedrooms: 1,
    valuesQuiet: false
  }
};

/** Rent at or below this share of the area's typical rent is fully affordable; at the upper share, not at all. */
const AFFORDABLE_RATIO = 0.7;
const UNAFFORDABLE_RATIO = 1.6;
/** Less than this share of weight judged: the result is shown with a "limited information" notice. */
export const OCCUPATION_MIN_JUDGED_SHARE = 50;

export interface OccupationListingFacts {
  monthlyFees: number | null;
  /** Median rent of currently available listings, as the affordability reference. */
  typicalRent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSize: string | null;
  amenityNames: string[];
  /** Nearby places + additional information, lower-cased. */
  accessText: string;
  houseRules: string;
}

export type OccupationReasonCode =
  | 'affordability.low'
  | 'affordability.typical'
  | 'affordability.high'
  | 'facilities.all'
  | 'facilities.some'
  | 'facilities.none'
  | 'location.access'
  | 'location.noAccess'
  | 'space.fits'
  | 'space.small'
  | 'rules.quiet'
  | 'rules.smokingAllowed'
  | 'rules.neutral';

export interface OccupationReason {
  factor: OccupationFactor;
  effect: 'up' | 'down' | 'neutral';
  code: OccupationReasonCode;
  params?: Record<string, string | number>;
}

export interface OccupationResult {
  id: string;
  name: string;
  /** Null when the listing gives no information to judge at all. */
  score: number | null;
  /** Share (0-100) of this occupation's weight the listing provided information for. */
  judgedShare: number;
  limited: boolean;
  weights: Record<OccupationFactor, number>;
  reasons: OccupationReason[];
  missing: OccupationFactor[];
}

export const profileFor = (name: string): OccupationProfile => OCCUPATION_PROFILES[name.trim().toLowerCase()] ?? DEFAULT_OCCUPATION_PROFILE;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const effectOf = (score: number): OccupationReason['effect'] => (score >= 0.75 ? 'up' : score <= 0.45 ? 'down' : 'neutral');
const QUIET_RULE = /quiet|no\s*(?:loud|noise|parties|party)/i;
const NO_SMOKING_RULE = /\bno[\s-]*smok|non[\s-]*smoking/i;

/** Scores one occupation category against the listing. Deterministic for the same inputs. */
export const scoreListingForOccupation = (occupation: { id: string; name: string }, listing: OccupationListingFacts): OccupationResult => {
  const profile = profileFor(occupation.name);
  const reasons: OccupationReason[] = [];
  const scores: Record<OccupationFactor, number | null> = { affordability: null, facilities: null, location: null, space: null, rules: null };
  const note = (factor: OccupationFactor, score: number, code: OccupationReasonCode, params?: OccupationReason['params']) => {
    scores[factor] = score;
    reasons.push({ factor, effect: effectOf(score), code, ...(params ? { params } : {}) });
  };

  // Affordability: rent compared with the typical rent of available listings.
  if (listing.monthlyFees && listing.monthlyFees > 0 && listing.typicalRent && listing.typicalRent > 0) {
    const ratio = listing.monthlyFees / listing.typicalRent;
    const score = clamp01((UNAFFORDABLE_RATIO - ratio) / (UNAFFORDABLE_RATIO - AFFORDABLE_RATIO));
    const percent = Math.round(ratio * 100);
    note('affordability', score, ratio <= 0.9 ? 'affordability.low' : ratio <= 1.15 ? 'affordability.typical' : 'affordability.high', { percent });
  }

  // Facilities: share of the amenities relevant to this category that the listing offers. The form
  // lists every amenity as a checkbox, so an unticked amenity means "not offered", not "unknown".
  {
    const offered = new Set(listing.amenityNames);
    const found = profile.amenities.filter((name) => offered.has(name));
    const missingNames = profile.amenities.filter((name) => !offered.has(name));
    const share = found.length / profile.amenities.length;
    note(
      'facilities',
      share,
      share === 1 ? 'facilities.all' : found.length === 0 ? 'facilities.none' : 'facilities.some',
      { found: found.join(', '), missing: missingNames.join(', '), count: found.length, total: profile.amenities.length }
    );
  }

  // Location and access: what the agent wrote about the surroundings.
  if (listing.accessText.trim()) {
    const hits = profile.accessWords.filter((word) => listing.accessText.includes(word));
    if (hits.length > 0) note('location', hits.length > 1 ? 1 : 0.85, 'location.access', { places: [...new Set(hits)].slice(0, 3).join(', ') });
    else note('location', 0.4, 'location.noAccess');
  }

  // Space: bedrooms against what typically fits (bathrooms add a little when there are several).
  if (listing.bedrooms && listing.bedrooms > 0) {
    const roomy = listing.bedrooms >= profile.bedrooms;
    const bathBonus = (listing.bathrooms ?? 0) >= 2 ? 0.1 : 0;
    note('space', clamp01((roomy ? 0.9 : 0.5) + bathBonus), roomy ? 'space.fits' : 'space.small', { bedrooms: listing.bedrooms, wanted: profile.bedrooms });
  }

  // House rules: quiet hours help people who study or work at home; smoking allowed is a mild minus.
  const smokingAllowed = listing.amenityNames.includes('SMOKING') && !NO_SMOKING_RULE.test(listing.houseRules);
  if (listing.houseRules.trim() || smokingAllowed) {
    if (QUIET_RULE.test(listing.houseRules)) note('rules', profile.valuesQuiet ? 1 : 0.7, 'rules.quiet');
    else if (smokingAllowed) note('rules', 0.4, 'rules.smokingAllowed');
    else note('rules', 0.6, 'rules.neutral');
  }

  const weights = Object.fromEntries(
    (Object.keys(OCCUPATION_FACTOR_WEIGHTS) as OccupationFactor[]).map((key) => [key, OCCUPATION_FACTOR_WEIGHTS[key] * (profile.emphasis[key] ?? 1)])
  ) as Record<OccupationFactor, number>;
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let judged = 0;
  let earned = 0;
  const missing: OccupationFactor[] = [];
  for (const key of Object.keys(weights) as OccupationFactor[]) {
    const score = scores[key];
    if (score === null) missing.push(key);
    else {
      judged += weights[key];
      earned += weights[key] * score;
    }
  }
  const judgedShare = Math.round((judged / total) * 100);

  // A completely empty form gives nothing to judge: no score rather than 0%.
  const hasAnyDetail = listing.amenityNames.length > 0 || missing.length < Object.keys(weights).length - 1;

  return {
    id: occupation.id,
    name: occupation.name,
    score: judged === 0 || !hasAnyDetail ? null : Math.max(0, Math.min(100, Math.round((earned / judged) * 100))),
    judgedShare,
    limited: judgedShare < OCCUPATION_MIN_JUDGED_SHARE,
    weights: Object.fromEntries(Object.entries(weights).map(([key, weight]) => [key, Math.round((weight / total) * 100)])) as Record<OccupationFactor, number>,
    reasons,
    missing
  };
};

/** Every occupation, best first (ties by name so the order is stable). */
export const scoreOccupations = (occupations: Array<{ id: string; name: string }>, listing: OccupationListingFacts): OccupationResult[] =>
  occupations
    .map((occupation) => scoreListingForOccupation(occupation, listing))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
