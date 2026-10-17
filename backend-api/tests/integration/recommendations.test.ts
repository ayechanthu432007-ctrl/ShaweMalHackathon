import request from 'supertest';

import { app } from '../../src/app';
import { signJwt } from '../../src/utils/jwt';

const authHeader = (userId: string, roles: string[]) => `Bearer ${signJwt({ sub: userId, email: `${userId}@example.com`, roles }, '1h')}`;

const yangon = { id: 'city-yangon', name: 'Yangon', stateId: 'state-yangon' };

const preference = (overrides: Record<string, unknown> = {}) => ({
  budgetMin: null,
  budgetMax: 400000,
  preferredCityId: yangon.id,
  preferredCity: yangon,
  propertyTypeId: null,
  propertyType: null,
  bedroomsMin: null,
  wantsFurnished: null,
  needsInternet: true,
  needsQuiet: null,
  amenityIds: [],
  moveInDate: null,
  leaseMonths: null,
  roomArrangement: null,
  cleanliness: null,
  sleepSchedule: null,
  smoking: 'NON_SMOKER',
  noiseTolerance: null,
  socialLevel: 'QUIET',
  guests: null,
  sharesChores: null,
  visibleToAgents: true,
  ...overrides
});

const houseRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  agentId: 'agent-1',
  title: `House ${id}`,
  description: null,
  nearbyPlaces: null,
  availability: 'AVAILABLE',
  monthlyFees: 300000,
  bedrooms: 2,
  bathrooms: 1,
  cityId: yangon.id,
  stateId: yangon.stateId,
  propertyTypeId: 'type-apartment',
  propertyType: { id: 'type-apartment', name: 'Apartment' },
  contractType: { id: 'contract-6', name: '6 Months', durationMonths: 6 },
  city: { id: yangon.id, name: yangon.name },
  state: { id: yangon.stateId, name: 'Yangon Region' },
  images: [{ imagePath: `houses/${id}.jpg`, sortOrder: 0 }],
  amenities: [{ amenity: { id: 'a-wifi', name: 'WIFI' } }],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides
});

const roommatePost = (id: string, flags: Record<string, unknown>) => ({
  id,
  userId: `poster-${id}`,
  title: `Roommate ${id}`,
  budgetCostSharing: '150,000 MMK',
  gender: 'ANY',
  occupationId: 'occ-student',
  occupation: { id: 'occ-student', name: 'Student' },
  photoPaths: [],
  isSmokingFriendly: false,
  isNoSmoking: false,
  likesNightOut: false,
  likesHangoutEveryday: false,
  hobbyChillWithOthers: false,
  hobbyRelaxSilent: false,
  hobbySinging: false,
  user: { id: `poster-${id}`, name: `Poster ${id}`, phone: '0911', profilePicturePath: null, housingPreference: null },
  house: { id: 'h-1', title: 'Shared flat', cityId: yangon.id, stateId: yangon.stateId, city: { id: yangon.id, name: yangon.name }, state: { id: yangon.stateId, name: 'Yangon Region' } },
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...flags
});

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn(async () => ({})) },
    house: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    roommatePost: { findMany: jest.fn(async () => []) },
    amenity: { findMany: jest.fn(async () => [{ id: 'a-wifi', name: 'WIFI' }]) },
    contractType: { findUnique: jest.fn(async () => ({ durationMonths: 6 })) },
    occupation: { findFirst: jest.fn(async () => ({ id: 'occ-student' })), findMany: jest.fn(async () => []) },
    city: { findFirst: jest.fn(async () => ({ id: 'city-yangon' })) },
    propertyType: { findFirst: jest.fn(async () => ({ id: 'type-apartment' })) },
    housingPreference: { upsert: jest.fn(async () => ({})) }
  };
  prisma.$transaction = jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma));
  return { prisma };
});

const { prisma } = jest.requireMock('../../src/prisma/client');
const seeker = { id: 'user-1', name: 'Thiri', occupation: { id: 'occ-remote', name: 'Remote Worker' }, housingPreference: preference() };

describe('recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(seeker);
  });

  it('requires sign-in everywhere', async () => {
    expect((await request(app).get('/api/v1/recommendations/houses')).status).toBe(401);
    expect((await request(app).get('/api/v1/recommendations/roommates')).status).toBe(401);
    expect((await request(app).get('/api/v1/profile/housing-preferences')).status).toBe(401);
    expect((await request(app).post('/api/v1/agent/houses/tenant-matches').send({})).status).toBe(401);
  });

  it('recommends available houses best first, without duplicates or over-budget homes', async () => {
    prisma.house.findMany.mockResolvedValue([
      houseRow('no-wifi', { amenities: [] }),
      houseRow('best'),
      houseRow('copy', { title: 'House best' }),
      houseRow('too-expensive', { monthlyFees: 439000 }),
      houseRow('other-city', { cityId: 'city-mandalay', stateId: 'state-mandalay' })
    ]);

    const response = await request(app).get('/api/v1/recommendations/houses').set('Authorization', authHeader('user-1', ['normal']));

    expect(response.status).toBe(200);
    expect(response.body.data.userName).toBe('Thiri');
    const ids = response.body.data.items.map((item: { house: { id: string } }) => item.house.id);
    expect(ids[0]).toBe('best');
    expect(ids).not.toContain('copy');
    expect(ids.indexOf('no-wifi')).toBeGreaterThan(0);
    const scores = response.body.data.items.map((item: { match: { score: number } }) => item.match.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    // Internet but no desk: the remote-work signal is only partly met, so just short of 100.
    expect(response.body.data.items[0].match).toMatchObject({ score: 97, confidence: 'HIGH' });
    expect(response.body.data.items[0].match.matched).toEqual(expect.arrayContaining(['budget', 'location', 'amenities']));

    const where = prisma.house.findMany.mock.calls[0][0].where;
    expect(where.availability).toBe('AVAILABLE');
    expect(where.agentId).toEqual({ not: 'user-1' });
  });

  it('returns what exists instead of padding the list to five', async () => {
    prisma.house.findMany.mockResolvedValue([houseRow('only')]);

    const response = await request(app).get('/api/v1/recommendations/houses').set('Authorization', authHeader('user-1', ['normal']));

    expect(response.body.data.items).toHaveLength(1);
  });

  it('ranks roommates by compatibility and pages the result', async () => {
    prisma.roommatePost.findMany.mockResolvedValue([
      roommatePost('loud', { isSmokingFriendly: true, likesNightOut: true }),
      roommatePost('quiet', { isNoSmoking: true, hobbyRelaxSilent: true })
    ]);

    const response = await request(app).get('/api/v1/recommendations/roommates?pageSize=1').set('Authorization', authHeader('user-1', ['normal']));

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].post.id).toBe('quiet');
    expect(response.body.data.items[0].match.matched).toEqual(expect.arrayContaining(['smoking', 'social']));
    expect(prisma.roommatePost.findMany.mock.calls[0][0].where.userId).toEqual({ not: 'user-1' });
  });

  describe('the roommate list', () => {
    const posts = () => [
      roommatePost('loud', { isSmokingFriendly: true, likesNightOut: true }),
      roommatePost('mine', { userId: 'user-1', isNoSmoking: true }),
      roommatePost('quiet', {
        isNoSmoking: true,
        hobbyRelaxSilent: true,
        user: { id: 'poster-quiet', name: 'Poster quiet', phone: '0911', profilePicturePath: null, housingPreference: preference({ smoking: 'NON_SMOKER' }) }
      })
    ];

    it('gives a signed-in visitor their match on every post, best first, without hiding any', async () => {
      prisma.roommatePost.findMany.mockResolvedValue(posts());

      const response = await request(app).get('/api/v1/roommates').set('Authorization', authHeader('user-1', ['normal']));

      expect(response.status).toBe(200);
      expect(response.body.data.viewer).toEqual({ signedIn: true, hasPreferences: true });
      const items = response.body.data.items as Array<{ id: string; match: { score: number } | null }>;
      // All three posts are returned once each; the lifestyle conflict ranks last among the scored ones.
      expect(items.map((item) => item.id)).toEqual(['quiet', 'loud', 'mine']);
      expect(items[0]!.match!.score).toBeGreaterThan(items[1]!.match!.score);
      // A person is never matched against their own post.
      expect(items[2]!.match).toBeNull();
      // The other person's saved preferences are used for scoring but never sent out.
      expect(JSON.stringify(response.body)).not.toContain('housingPreference');
    });

    it('scores differently for a different person', async () => {
      prisma.roommatePost.findMany.mockResolvedValue(posts());
      prisma.user.findUnique.mockResolvedValue({ ...seeker, housingPreference: preference({ smoking: 'SMOKER', socialLevel: 'SOCIAL' }) });

      const response = await request(app).get('/api/v1/roommates').set('Authorization', authHeader('user-9', ['normal']));

      expect(response.body.data.items[0].id).toBe('loud');
    });

    it('returns the plain list to visitors who are not signed in', async () => {
      prisma.roommatePost.findMany.mockResolvedValue(posts());

      const response = await request(app).get('/api/v1/roommates');

      expect(response.status).toBe(200);
      expect(response.body.data.viewer).toEqual({ signedIn: false, hasPreferences: false });
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data.items.every((item: { match: unknown }) => item.match === null)).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('marks every match incomplete, not 0%, when the visitor has saved no preferences', async () => {
      prisma.roommatePost.findMany.mockResolvedValue(posts());
      prisma.user.findUnique.mockResolvedValue({ ...seeker, occupation: null, housingPreference: null });

      const response = await request(app).get('/api/v1/roommates').set('Authorization', authHeader('user-1', ['normal']));

      expect(response.body.data.viewer.hasPreferences).toBe(false);
      const scored = response.body.data.items.filter((item: { match: unknown }) => item.match !== null);
      expect(scored.every((item: { match: { confidence: string } }) => item.match.confidence === 'INCOMPLETE')).toBe(true);
    });
  });

  describe('related houses', () => {
    const current = { cityId: yangon.id, stateId: yangon.stateId, propertyTypeId: 'type-apartment', monthlyFees: 300000 };

    it('lists similar available listings, most alike first, never the listing itself', async () => {
      prisma.house.findUnique.mockResolvedValue(current);
      prisma.house.findMany.mockResolvedValue([
        houseRow('far-and-different', { cityId: 'city-mandalay', stateId: 'state-mandalay', propertyTypeId: 'type-villa', monthlyFees: 2000000 }),
        houseRow('same-township', { propertyTypeId: 'type-villa', monthlyFees: 2000000 }),
        houseRow('twin')
      ]);

      const response = await request(app).get('/api/v1/houses/house-1/related');

      expect(response.status).toBe(200);
      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual(['twin', 'same-township', 'far-and-different']);
      expect(response.body.data.items[0]).toMatchObject({ title: 'House twin', monthlyFees: 300000, thumbnail: 'houses/twin.jpg' });
      const where = prisma.house.findMany.mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 'house-1' });
      expect(where.availability).toBe('AVAILABLE');
    });

    it('answers 404 for a listing that does not exist', async () => {
      prisma.house.findUnique.mockResolvedValue(null);

      expect((await request(app).get('/api/v1/houses/nope/related')).status).toBe(404);
    });
  });

  it('lets only agents ask for potential tenants', async () => {
    const response = await request(app)
      .post('/api/v1/agent/houses/tenant-matches')
      .set('Authorization', authHeader('user-1', ['normal']))
      .send({ monthlyFees: 300000, cityId: yangon.id });

    expect(response.status).toBe(403);
  });

  it('suggests only people who opted in, and never their contact details', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-2', name: 'Aung', email: 'aung@example.com', phone: '0999', profilePicturePath: null, occupation: { id: 'o', name: 'Student' }, housingPreference: preference({ budgetMax: 250000 }) },
      { id: 'user-1', name: 'Thiri', email: 'thiri@example.com', phone: '0988', profilePicturePath: null, occupation: seeker.occupation, housingPreference: preference() }
    ]);

    const response = await request(app)
      .post('/api/v1/agent/houses/tenant-matches')
      .set('Authorization', authHeader('agent-1', ['agent']))
      .send({ monthlyFees: 300000, cityId: yangon.id, stateId: yangon.stateId, propertyTypeId: 'type-apartment', bedrooms: 2, amenityIds: ['a-wifi'] });

    expect(response.status).toBe(200);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: 'agent-1' });
    expect(where.housingPreference.is.visibleToAgents).toBe(true);

    const items = response.body.data.items;
    expect(items.map((item: { user: { name: string } }) => item.user.name)).toEqual(['Thiri', 'Aung']);
    expect(items[0].match.score).toBeGreaterThan(items[1].match.score);
    expect(items[1].match.conflicts).toContain('budget');
    expect(JSON.stringify(response.body)).not.toMatch(/example\.com|0999|0988/);
  });

  describe('tenant compatibility summary', () => {
    const draft = { monthlyFees: 300000, cityId: yangon.id, stateId: yangon.stateId, propertyTypeId: 'type-apartment', bedrooms: 2, amenityIds: ['a-wifi'] };
    const ask = (body: Record<string, unknown>) =>
      request(app).post('/api/v1/agent/houses/tenant-matches').set('Authorization', authHeader('agent-1', ['agent'])).send(body);

    it('scores people over budget instead of hiding them, and summarises the result', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-2', name: 'Aung', profilePicturePath: null, occupation: null, housingPreference: preference({ budgetMax: 150000 }) },
        { id: 'user-1', name: 'Thiri', profilePicturePath: null, occupation: seeker.occupation, housingPreference: preference() },
        // Saved preferences with no budget and no location: too little to score.
        { id: 'user-3', name: 'Mya', profilePicturePath: null, occupation: null, housingPreference: preference({ budgetMax: null, preferredCityId: null, preferredCity: null }) }
      ]);

      const response = await ask(draft);
      expect(response.status).toBe(200);
      const data = response.body.data;

      // No budget pre-filter in the query any more.
      expect(JSON.stringify(prisma.user.findMany.mock.calls[0][0].where)).not.toContain('budgetMax');
      expect(data).toMatchObject({ basis: 'DRAFT', evaluated: 3, insufficient: 1, scoredCount: 2 });
      expect(data.items.map((item: { user: { name: string } }) => item.user.name)).toEqual(['Thiri', 'Aung']);

      const aung = data.items[1];
      expect(aung.match.tier).toBe('LOW');
      expect(aung.match.reasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'budget.over', status: 'conflict' })]));

      const scores = data.items.map((item: { match: { score: number } }) => item.match.score);
      expect(data.overallScore).toBe(Math.round((scores[0] + scores[1]) / 2));
      expect(data.bestScore).toBe(scores[0]);
      expect(data.tiers.LOW).toBeGreaterThanOrEqual(1);
      expect(data.factorSummary.find((row: { key: string }) => row.key === 'budget')).toMatchObject({ conflict: 1 });
      expect(data.method.weights).toEqual({ budget: 30, location: 20, amenities: 20, space: 15, timing: 10, rules: 5 });
    });

    it('explains an empty result instead of inventing matches', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const response = await ask(draft);
      expect(response.body.data).toMatchObject({ evaluated: 0, scoredCount: 0, overallScore: null, bestScore: null, strongMatches: 0, items: [] });
    });

    it('recalculates when the listing details change', async () => {
      const people = [{ id: 'user-1', name: 'Thiri', profilePicturePath: null, occupation: null, housingPreference: preference({ bedroomsMin: 2 }) }];
      prisma.user.findMany.mockResolvedValue(people);
      const affordable = await ask(draft);
      const expensive = await ask({ ...draft, monthlyFees: 900000 });
      const fewerRooms = await ask({ ...draft, bedrooms: 1 });

      const score = (res: typeof affordable) => res.body.data.items[0].match.score;
      expect(score(expensive)).toBeLessThan(score(affordable));
      expect(score(fewerRooms)).toBeLessThan(score(affordable));
      expect(expensive.body.data.items[0].match.reasons.map((reason: { code: string }) => reason.code)).toContain('budget.over');
    });
  });

  describe('occupation compatibility', () => {
    const occupations = ['Engineer', 'General Worker', 'Healthcare Professional', 'Other', 'Remote Worker', 'Software / IT Professional', 'Student', 'Teacher / Educator'].map((name, i) => ({ id: `o${i}`, name }));
    const ask = (body: Record<string, unknown>, roles = ['agent']) =>
      request(app).post('/api/v1/agent/houses/occupation-compatibility').set('Authorization', authHeader('agent-1', roles)).send(body);

    it('scores every active occupation from the unsaved draft, without any tenant records', async () => {
      prisma.occupation.findMany.mockResolvedValue(occupations);
      prisma.house.findMany.mockResolvedValue([{ monthlyFees: 300000 }, { monthlyFees: 400000 }]);
      const response = await ask({ monthlyFees: 300000, bedrooms: 2, amenityIds: ['a-wifi'], nearbyPlaces: 'near the university', houseRules: 'quiet hours' });

      expect(response.status).toBe(200);
      expect(prisma.occupation.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      const items = response.body.data.items;
      expect(items).toHaveLength(8);
      expect(response.body.data).toMatchObject({ basis: 'DRAFT', typicalRent: 350000 });
      const scores = items.map((item: { score: number }) => item.score);
      expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
    });

    it('updates the scores when the draft changes', async () => {
      prisma.occupation.findMany.mockResolvedValue(occupations);
      prisma.house.findMany.mockResolvedValue([{ monthlyFees: 300000 }]);
      const student = async (body: Record<string, unknown>) =>
        (await ask(body)).body.data.items.find((item: { name: string }) => item.name === 'Student').score;
      expect(await student({ monthlyFees: 600000, bedrooms: 1 })).toBeLessThan(await student({ monthlyFees: 200000, bedrooms: 1 }));
    });

    it('works with an almost empty draft and is limited to agents', async () => {
      prisma.occupation.findMany.mockResolvedValue(occupations);
      const empty = await ask({});
      expect(empty.status).toBe(200);
      expect(empty.body.data.items.every((item: { score: number | null }) => item.score === null)).toBe(true);
      expect((await ask({}, ['normal'])).status).toBe(403);
    });
  });

  it('rejects an incomplete listing draft', async () => {
    const response = await request(app).post('/api/v1/agent/houses/tenant-matches').set('Authorization', authHeader('agent-1', ['agent'])).send({ cityId: yangon.id });

    expect(response.status).toBe(400);
  });

  it('saves preferences and refuses an impossible budget range', async () => {
    const headers = authHeader('user-1', ['normal']);
    const saved = await request(app).put('/api/v1/profile/housing-preferences').set('Authorization', headers).send({ budgetMin: 100000, budgetMax: 300000, smoking: 'NON_SMOKER', visibleToAgents: true, occupationId: 'occ-student' });
    const inverted = await request(app).put('/api/v1/profile/housing-preferences').set('Authorization', headers).send({ budgetMin: 500000, budgetMax: 300000 });
    const badChoice = await request(app).put('/api/v1/profile/housing-preferences').set('Authorization', headers).send({ smoking: 'SOMETIMES' });

    expect(saved.status).toBe(200);
    expect(prisma.housingPreference.upsert.mock.calls[0][0].update).toMatchObject({ budgetMax: 300000, smoking: 'NON_SMOKER', visibleToAgents: true });
    expect(prisma.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'user-1' }, data: { occupationId: 'occ-student' } });
    expect(inverted.status).toBe(400);
    expect(inverted.body.errors.code).toBe('BUDGET_RANGE_INVALID');
    expect(badChoice.status).toBe(400);
  });
});
