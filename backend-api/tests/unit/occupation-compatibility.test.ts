import {
  OccupationListingFacts,
  scoreListingForOccupation,
  scoreOccupations
} from '../../src/services/occupation-compatibility';

/** The occupation list as seeded in the application. */
const OCCUPATIONS = [
  'Engineer',
  'General Worker',
  'Healthcare Professional',
  'Other',
  'Remote Worker',
  'Software / IT Professional',
  'Student',
  'Teacher / Educator'
].map((name, index) => ({ id: `occ-${index}`, name }));

const listing = (overrides: Partial<OccupationListingFacts> = {}): OccupationListingFacts => ({
  monthlyFees: 300_000,
  typicalRent: 350_000,
  bedrooms: 2,
  bathrooms: 1,
  areaSize: '800 sqft',
  amenityNames: ['WIFI', 'DESK', 'AIR CONDITIONER', 'FURNISHED', 'WATER HEATER'],
  accessText: 'near yangon university and the bus stop',
  houseRules: 'Quiet hours after 10pm.',
  ...overrides
});

const byName = (results: ReturnType<typeof scoreOccupations>, name: string) => results.find((item) => item.name === name)!;

describe('occupation compatibility', () => {
  it('returns every occupation, sorted from highest to lowest', () => {
    const results = scoreOccupations(OCCUPATIONS, listing());
    expect(results.map((item) => item.name).sort()).toEqual(OCCUPATIONS.map((item) => item.name).sort());
    const scores = results.map((item) => item.score ?? -1);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('gives different occupations different scores for explainable reasons', () => {
    const results = scoreOccupations(OCCUPATIONS, listing());
    const remote = byName(results, 'Remote Worker');
    const worker = byName(results, 'General Worker');
    expect(remote.score).toBeGreaterThan(worker.score!);
    expect(remote.reasons.find((reason) => reason.factor === 'facilities')).toMatchObject({ code: 'facilities.all', effect: 'up' });
    expect(worker.reasons.find((reason) => reason.factor === 'facilities')?.code).toBe('facilities.some');
  });

  it('lowers affordability-sensitive occupations more when the rent rises', () => {
    const cheap = scoreOccupations(OCCUPATIONS, listing({ monthlyFees: 250_000 }));
    const dear = scoreOccupations(OCCUPATIONS, listing({ monthlyFees: 550_000 }));
    const drop = (name: string) => byName(cheap, name).score! - byName(dear, name).score!;
    expect(drop('Student')).toBeGreaterThan(0);
    expect(drop('Student')).toBeGreaterThan(drop('Remote Worker'));
    expect(byName(dear, 'Student').reasons.find((reason) => reason.factor === 'affordability')).toMatchObject({ code: 'affordability.high', effect: 'down' });
  });

  it('responds to amenities, space and house rules', () => {
    const it = (facts: Partial<OccupationListingFacts>) => byName(scoreOccupations(OCCUPATIONS, listing(facts)), 'Software / IT Professional').score!;
    expect(it({ amenityNames: ['FAN'] })).toBeLessThan(it({}));
    expect(it({ bedrooms: 1 })).toBeLessThan(it({}));
    expect(it({ houseRules: 'Smoking allowed', amenityNames: [...listing().amenityNames, 'SMOKING'] })).toBeLessThan(it({}));
  });

  it('uses nearby places for access', () => {
    const nearHospital = byName(scoreOccupations(OCCUPATIONS, listing({ accessText: 'walk to the general hospital' })), 'Healthcare Professional');
    const nowhere = byName(scoreOccupations(OCCUPATIONS, listing({ accessText: 'lovely garden' })), 'Healthcare Professional');
    expect(nearHospital.reasons.find((reason) => reason.factor === 'location')?.code).toBe('location.access');
    expect(nowhere.reasons.find((reason) => reason.factor === 'location')?.code).toBe('location.noAccess');
    expect(nearHospital.score).toBeGreaterThan(nowhere.score!);
  });

  it('never counts missing details as a match', () => {
    const sparse = listing({ amenityNames: [], accessText: '', houseRules: '', bedrooms: null, monthlyFees: 300_000 });
    const result = scoreListingForOccupation({ id: 's', name: 'Student' }, sparse);
    expect(result.missing).toEqual(expect.arrayContaining(['location', 'space', 'rules']));
    // Unticked amenities mean none offered: scored as a mismatch, not skipped.
    expect(result.reasons.find((reason) => reason.factor === 'facilities')?.code).toBe('facilities.none');
    // Only house rules entered (no rent, amenities, nearby places or bedrooms): flagged as limited.
    const onlyRules = scoreListingForOccupation({ id: 's', name: 'Student' }, listing({ monthlyFees: null, amenityNames: [], accessText: '', bedrooms: null, houseRules: 'Quiet hours' }));
    expect(onlyRules.limited).toBe(true);

    const empty = scoreListingForOccupation({ id: 's', name: 'Student' }, listing({ monthlyFees: null, amenityNames: [], accessText: '', houseRules: '', bedrooms: null }));
    expect(empty.score).toBeNull();
  });

  it('does not raise scores when no amenities are ticked', () => {
    const results = scoreOccupations(OCCUPATIONS, listing());
    const bare = scoreOccupations(OCCUPATIONS, listing({ amenityNames: [] }));
    for (const item of bare) expect(item.score!).toBeLessThan(byName(results, item.name).score!);
  });

  it('treats an occupation without its own rule neutrally', () => {
    const newcomer = scoreListingForOccupation({ id: 'x', name: 'Musician' }, listing());
    const other = scoreListingForOccupation({ id: 'o', name: 'Other' }, listing());
    expect(newcomer.score).toBe(other.score);
  });

  it('stays within 0 to 100 and is deterministic', () => {
    const extremes: Array<Partial<OccupationListingFacts>> = [
      { monthlyFees: 50_000_000 },
      { monthlyFees: 1 },
      { amenityNames: [], accessText: 'x', houseRules: 'x', bedrooms: 9, bathrooms: 9 }
    ];
    for (const facts of extremes) {
      const a = scoreOccupations(OCCUPATIONS, listing(facts));
      expect(a).toEqual(scoreOccupations(OCCUPATIONS, listing(facts)));
      for (const item of a) {
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(100);
      }
    }
  });
});
