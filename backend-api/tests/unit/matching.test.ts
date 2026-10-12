import {
  HouseFacts,
  PersonFacts,
  PersonPreferences,
  RoommateFacts,
  median,
  parseMonthlyAmount,
  scoreHouseForPerson,
  scoreRoommateForPerson
} from '../../src/services/matching';

const NOW = new Date('2026-10-12T00:00:00Z');

const preferences = (overrides: Partial<PersonPreferences> = {}): PersonPreferences => ({
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

const person = (overrides: Partial<PersonPreferences> | null, occupationName: string | null = null): PersonFacts => ({
  occupationId: occupationName ? `occ-${occupationName}` : null,
  occupationName,
  preferences: overrides === null ? null : preferences(overrides)
});

const house = (overrides: Partial<HouseFacts> = {}): HouseFacts => ({
  monthlyFees: 300_000,
  cityId: 'city-yangon',
  stateId: 'state-yangon',
  propertyTypeId: 'type-apartment',
  bedrooms: 2,
  amenityIds: ['a-wifi', 'a-furnished'],
  amenityNames: ['WIFI', 'FURNISHED'],
  contractMonths: 6,
  nearbyText: '',
  ...overrides
});

const roommate = (overrides: Partial<RoommateFacts> = {}): RoommateFacts => ({
  occupationId: null,
  cityId: 'city-yangon',
  stateId: 'state-yangon',
  budget: 150_000,
  isSmokingFriendly: false,
  isNoSmoking: false,
  likesNightOut: false,
  likesHangoutEveryday: false,
  hobbyChillWithOthers: false,
  hobbyRelaxSilent: false,
  hobbySinging: false,
  preferences: null,
  ...overrides
});

describe('house matching', () => {
  const wanted = {
    budgetMax: 350_000,
    preferredCityId: 'city-yangon',
    preferredStateId: 'state-yangon',
    propertyTypeId: 'type-apartment',
    bedroomsMin: 2,
    wantsFurnished: true,
    needsInternet: true,
    leaseMonths: 6
  };

  it('scores a house that meets every stated requirement at 100 with high confidence', () => {
    const result = scoreHouseForPerson(house(), person(wanted), { medianRent: 300_000, now: NOW });

    expect(result.score).toBe(100);
    expect(result.confidence).toBe('HIGH');
    expect(result.conflicts).toEqual([]);
    expect(result.matched.slice(0, 2)).toEqual(['budget', 'location']);
  });

  it('caps the score when the rent is well above the maximum budget, whatever else matches', () => {
    const result = scoreHouseForPerson(house({ monthlyFees: 500_000 }), person(wanted), { medianRent: 300_000, now: NOW });

    expect(result.conflicts).toContain('budget');
    expect(result.score).toBeLessThanOrEqual(45);
  });

  it('treats a rent slightly above the maximum as a partial fit, not a conflict', () => {
    const result = scoreHouseForPerson(house({ monthlyFees: 370_000 }), person(wanted), { medianRent: 300_000, now: NOW });

    expect(result.conflicts).not.toContain('budget');
    expect(result.matched).not.toContain('budget');
    expect(result.score).toBeLessThan(100);
  });

  it('penalises a house in another city and reports the conflict', () => {
    const elsewhere = scoreHouseForPerson(house({ cityId: 'city-mandalay', stateId: 'state-mandalay' }), person(wanted), { medianRent: null, now: NOW });
    const here = scoreHouseForPerson(house(), person(wanted), { medianRent: null, now: NOW });

    expect(elsewhere.conflicts).toContain('location');
    expect(elsewhere.score).toBeLessThan(here.score - 20);
  });

  it('never counts missing information as a match and labels the result low confidence', () => {
    const result = scoreHouseForPerson(house(), person({ budgetMax: 350_000 }), { medianRent: null, now: NOW });

    expect(result.matched).toEqual(['budget']);
    expect(result.missing).toEqual(expect.arrayContaining(['location', 'preferences', 'room', 'amenities', 'lease', 'occupation']));
    expect(result.confidence).toBe('LOW');
  });

  it('labels a person with no saved preferences as an incomplete profile', () => {
    const result = scoreHouseForPerson(house(), person(null, 'Student'), { medianRent: 300_000, now: NOW });

    expect(result.confidence).toBe('INCOMPLETE');
  });

  it('uses occupation only as a small signal: stated preferences decide the ranking', () => {
    const remoteWorker = (overrides: Partial<PersonPreferences>) => person(overrides, 'Remote Worker');
    const withInternet = house();
    const withoutInternet = house({ amenityIds: [], amenityNames: [] });

    const sameBudget = { budgetMax: 350_000, preferredCityId: 'city-yangon', preferredStateId: 'state-yangon' };
    const a = scoreHouseForPerson(withInternet, remoteWorker(sameBudget), { medianRent: null, now: NOW });
    const b = scoreHouseForPerson(withoutInternet, remoteWorker(sameBudget), { medianRent: null, now: NOW });

    expect(a.score).toBeGreaterThan(b.score);
    // The occupation signal alone moves the result by a few points, never by a whole tier.
    expect(a.score - b.score).toBeLessThanOrEqual(12);
  });
});

describe('roommate matching', () => {
  it('ranks a lifestyle match above a lifestyle conflict', () => {
    const me = person({ smoking: 'NON_SMOKER', socialLevel: 'QUIET', noiseTolerance: 'LOW', budgetMax: 200_000, preferredCityId: 'city-yangon' }, 'Student');
    const quiet = scoreRoommateForPerson(roommate({ isNoSmoking: true, hobbyRelaxSilent: true }), me);
    const loud = scoreRoommateForPerson(roommate({ isSmokingFriendly: true, likesNightOut: true, hobbySinging: true }), me);

    expect(quiet.score).toBeGreaterThan(loud.score + 30);
    expect(loud.conflicts).toEqual(expect.arrayContaining(['smoking', 'social', 'noise']));
    expect(quiet.matched.length).toBeGreaterThanOrEqual(3);
  });

  it('does not treat a different occupation as a conflict', () => {
    const me: PersonFacts = { ...person({ smoking: 'ANY' }, 'Student'), occupationId: 'occ-student' };
    const result = scoreRoommateForPerson(roommate({ occupationId: 'occ-remote', isNoSmoking: true }), me);

    expect(result.conflicts).not.toContain('occupation');
  });

  it('compares habits only when both people stated them', () => {
    const me = person({ cleanliness: 'VERY_TIDY', sleepSchedule: 'EARLY' });
    const unknown = scoreRoommateForPerson(roommate(), me);
    const known = scoreRoommateForPerson(roommate({ preferences: preferences({ cleanliness: 'RELAXED', sleepSchedule: 'FLEXIBLE' }) }), me);

    expect(unknown.missing).toEqual(expect.arrayContaining(['cleanliness', 'sleep']));
    expect(known.conflicts).toContain('cleanliness');
    expect(known.matched).toContain('sleep');
  });
});

describe('helpers', () => {
  it('reads a monthly amount from free text', () => {
    expect(parseMonthlyAmount('150,000 MMK')).toBe(150_000);
    expect(parseMonthlyAmount('1.5 lakh per month')).toBe(150_000);
    expect(parseMonthlyAmount('200k')).toBe(200_000);
    expect(parseMonthlyAmount('negotiable')).toBeNull();
  });

  it('finds the median rent', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(median([])).toBeNull();
  });
});
