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
    house: { findMany: jest.fn(async () => []) },
    roommatePost: { findMany: jest.fn(async () => []) },
    amenity: { findMany: jest.fn(async () => [{ id: 'a-wifi', name: 'WIFI' }]) },
    contractType: { findUnique: jest.fn(async () => ({ durationMonths: 6 })) },
    occupation: { findFirst: jest.fn(async () => ({ id: 'occ-student' })) },
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
