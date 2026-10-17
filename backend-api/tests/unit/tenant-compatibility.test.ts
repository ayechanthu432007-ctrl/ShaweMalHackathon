import {
  ListingFacts,
  PersonPreferences,
  TENANT_MATCH_THRESHOLDS,
  TENANT_MATCH_WEIGHTS,
  TenantFacts,
  scoreListingForTenant,
  tierOf
} from '../../src/services/matching';

const NOW = new Date('2026-10-17T00:00:00Z');

const prefs = (overrides: Partial<PersonPreferences> = {}): PersonPreferences => ({
  budgetMin: null,
  budgetMax: null,
  preferredCityId: null,
  preferredStateId: null,
  propertyTypeId: null,
  bedroomsMin: null,
  wantsFurnished: null,
  needsInternet: null,
  needsQuiet: null,
  amenityIds: [],
  moveInDate: null,
  leaseMonths: null,
  roomArrangement: null,
  cleanliness: null,
  sleepSchedule: null,
  smoking: null,
  noiseTolerance: null,
  socialLevel: null,
  guests: null,
  sharesChores: null,
  ...overrides
});

const tenant = (overrides: Partial<PersonPreferences> | null, extra: Partial<TenantFacts> = {}): TenantFacts => ({
  occupationId: null,
  occupationName: null,
  preferences: overrides === null ? null : prefs(overrides),
  requiredAmenityNames: [],
  ...extra
});

const listing = (overrides: Partial<ListingFacts> = {}): ListingFacts => ({
  monthlyFees: 300_000,
  cityId: 'city-tamwe',
  stateId: 'state-yangon',
  propertyTypeId: 'type-apartment',
  bedrooms: 2,
  amenityIds: ['a-wifi', 'a-furnished'],
  amenityNames: ['WIFI', 'FURNISHED'],
  contractMonths: 6,
  nearbyText: '',
  rulesText: '',
  ...overrides
});

/** Someone who stated every requirement this listing meets. */
const ideal = {
  budgetMax: 350_000,
  preferredCityId: 'city-tamwe',
  preferredStateId: 'state-yangon',
  propertyTypeId: 'type-apartment',
  bedroomsMin: 2,
  wantsFurnished: true,
  needsInternet: true,
  leaseMonths: 12,
  moveInDate: new Date('2026-11-01T00:00:00Z'),
  smoking: 'NON_SMOKER'
};

const codes = (result: ReturnType<typeof scoreListingForTenant>) => result.reasons.map((reason) => reason.code);

describe('listing → tenant compatibility', () => {
  it('scores a listing that meets every stated requirement at 100 with high confidence', () => {
    const result = scoreListingForTenant(listing(), tenant(ideal), NOW);
    expect(result.score).toBe(100);
    expect(result.confidence).toBe('HIGH');
    expect(result.conflicts).toEqual([]);
    expect(codes(result)).toEqual(
      expect.arrayContaining(['budget.within', 'location.city', 'space.typeMatch', 'space.bedroomsEnough', 'amenities.all', 'timing.leaseFits', 'timing.moveInSoon', 'rules.smokeFree'])
    );
  });

  it('treats an exact budget as within budget, and a rent up to 10% over as a partial fit', () => {
    const exact = scoreListingForTenant(listing({ monthlyFees: 350_000 }), tenant(ideal), NOW);
    expect(codes(exact)).toContain('budget.within');
    expect(exact.score).toBe(100);

    const slightlyOver = scoreListingForTenant(listing({ monthlyFees: 380_000 }), tenant(ideal), NOW);
    expect(codes(slightlyOver)).toContain('budget.slightlyOver');
    expect(slightlyOver.conflicts).not.toContain('budget');
    expect(slightlyOver.score).toBeLessThan(100);
    expect(slightlyOver.score).toBeGreaterThan(TENANT_MATCH_THRESHOLDS.medium);
  });

  it('gives a low score, capped, when the rent exceeds what the tenant can pay', () => {
    const result = scoreListingForTenant(listing({ monthlyFees: 600_000 }), tenant(ideal), NOW);
    expect(codes(result)).toContain('budget.over');
    expect(result.reasons.find((reason) => reason.code === 'budget.over')?.params).toEqual({ over: 250_000 });
    expect(result.conflicts).toContain('budget');
    expect(result.score).toBeLessThanOrEqual(TENANT_MATCH_THRESHOLDS.budgetConflictCap);
    expect(tierOf(result.score)).toBe('LOW');
  });

  it('rewards the preferred township, partly the same region, and penalises elsewhere', () => {
    const city = scoreListingForTenant(listing(), tenant(ideal), NOW);
    const region = scoreListingForTenant(listing({ cityId: 'city-sanchaung' }), tenant(ideal), NOW);
    const elsewhere = scoreListingForTenant(listing({ cityId: 'city-chanmya', stateId: 'state-mandalay' }), tenant(ideal), NOW);
    expect(codes(region)).toContain('location.region');
    expect(codes(elsewhere)).toContain('location.outside');
    expect(city.score).toBeGreaterThan(region.score);
    expect(region.score).toBeGreaterThan(elsewhere.score);
  });

  it('checks property type and bedrooms separately', () => {
    const wrongType = scoreListingForTenant(listing({ propertyTypeId: 'type-condo' }), tenant(ideal), NOW);
    const tooSmall = scoreListingForTenant(listing({ bedrooms: 1 }), tenant(ideal), NOW);
    expect(codes(wrongType)).toContain('space.typeMismatch');
    expect(codes(wrongType)).toContain('space.bedroomsEnough');
    expect(codes(tooSmall)).toContain('space.bedroomsShort');
    expect(wrongType.score).toBeLessThan(100);
    expect(tooSmall.score).toBeLessThan(100);
  });

  it('counts each required amenity once and names the missing ones', () => {
    // Internet is required twice (needsInternet and the WIFI amenity); it is still one requirement.
    const result = scoreListingForTenant(
      listing({ amenityIds: ['a-wifi'], amenityNames: ['WIFI'] }),
      tenant({ ...ideal }, { requiredAmenityNames: ['WIFI', 'PARKING'] }),
      NOW
    );
    const amenities = result.reasons.find((reason) => reason.factor === 'amenities');
    expect(amenities).toMatchObject({ code: 'amenities.some', params: { found: 1, total: 3, missing: 'FURNISHED, PARKING' } });
  });

  it('flags an explicit "no pets" rule against a tenant who needs a pet-friendly home', () => {
    const petTenant = tenant({ ...ideal }, { requiredAmenityNames: ['PETS'] });
    const allowed = scoreListingForTenant(listing({ amenityNames: ['WIFI', 'FURNISHED', 'PETS'] }), petTenant, NOW);
    const ruledOut = scoreListingForTenant(listing({ amenityNames: ['WIFI', 'FURNISHED', 'PETS'], rulesText: 'No pets please.' }), petTenant, NOW);
    expect(codes(allowed)).toContain('amenities.all');
    expect(codes(ruledOut)).toContain('amenities.petsRuleConflict');
    expect(ruledOut.score).toBeLessThan(allowed.score);
  });

  it('treats a smoking-allowed listing as a conflict for someone who needs a non-smoking home, unless the rules forbid smoking', () => {
    const smokingAllowed = scoreListingForTenant(listing({ amenityNames: ['WIFI', 'FURNISHED', 'SMOKING'] }), tenant(ideal), NOW);
    const forbiddenByRules = scoreListingForTenant(listing({ amenityNames: ['WIFI', 'FURNISHED', 'SMOKING'], rulesText: 'Strictly no smoking inside.' }), tenant(ideal), NOW);
    expect(codes(smokingAllowed)).toContain('rules.smokingAllowed');
    expect(smokingAllowed.conflicts).toContain('rules');
    expect(codes(forbiddenByRules)).toContain('rules.smokeFree');
    expect(smokingAllowed.score).toBeLessThan(forbiddenByRules.score);
  });

  it('does not treat "smoking is fine" or "no preference" as a requirement', () => {
    for (const smoking of ['SMOKER', 'ANY']) {
      const result = scoreListingForTenant(listing(), tenant({ ...ideal, smoking }), NOW);
      expect(result.missing).toContain('rules');
    }
  });

  it('never counts missing information as a match', () => {
    const result = scoreListingForTenant(listing(), tenant({ budgetMax: 350_000, preferredCityId: 'city-tamwe', preferredStateId: 'state-yangon' }), NOW);
    expect(result.matched).toEqual(['budget', 'location']);
    expect(result.missing).toEqual(expect.arrayContaining(['amenities', 'space', 'timing', 'rules']));
    // Budget and location are half the weight: scored, but labelled low confidence.
    expect(result.confidence).toBe('LOW');
  });

  it('reports insufficient information instead of a score when too little is known', () => {
    expect(scoreListingForTenant(listing(), tenant(null), NOW).confidence).toBe('INCOMPLETE');
    // Only bedrooms and furnished: no budget and no location.
    expect(scoreListingForTenant(listing(), tenant({ bedroomsMin: 1, wantsFurnished: true }), NOW).confidence).toBe('INCOMPLETE');
    // Only the budget (30% of the weight) is below the 40% minimum.
    expect(scoreListingForTenant(listing(), tenant({ budgetMax: 400_000 }), NOW).confidence).toBe('INCOMPLETE');
  });

  it('does not score occupation', () => {
    const student = scoreListingForTenant(listing(), tenant(ideal, { occupationId: 'o1', occupationName: 'Student' }), NOW);
    const nurse = scoreListingForTenant(listing(), tenant(ideal, { occupationId: 'o2', occupationName: 'Healthcare' }), NOW);
    expect(student).toEqual(nurse);
    expect(Object.keys(TENANT_MATCH_WEIGHTS)).not.toContain('occupation');
  });

  it('stays between 0 and 100 and is deterministic', () => {
    const cases: Array<[Partial<ListingFacts>, Partial<PersonPreferences>]> = [
      [{ monthlyFees: 5_000_000, cityId: 'x', stateId: 'y', propertyTypeId: 'z', bedrooms: 0, amenityNames: ['SMOKING'] }, ideal],
      [{}, ideal],
      [{ monthlyFees: 1 }, { ...ideal, budgetMin: 300_000 }]
    ];
    for (const [l, p] of cases) {
      const a = scoreListingForTenant(listing(l), tenant(p), NOW);
      const b = scoreListingForTenant(listing(l), tenant(p), NOW);
      expect(a).toEqual(b);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });

  it('uses the high / medium / low bands from the shared thresholds', () => {
    expect(tierOf(100)).toBe('HIGH');
    expect(tierOf(75)).toBe('HIGH');
    expect(tierOf(74)).toBe('MEDIUM');
    expect(tierOf(50)).toBe('MEDIUM');
    expect(tierOf(49)).toBe('LOW');
    expect(tierOf(0)).toBe('LOW');
  });
});
