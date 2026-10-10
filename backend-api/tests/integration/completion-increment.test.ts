import request from 'supertest';

import { app } from '../../src/app';
import { signJwt } from '../../src/utils/jwt';

const authHeader = (userId: string, rolesList: string[]) => {
  const token = signJwt({ sub: userId, email: `${userId}@example.com`, roles: rolesList }, '1h');
  return `Bearer ${token}`;
};

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    $executeRaw: jest.fn(async () => 1),
    // Plans and boosts are covered by subscriptions.test.ts; here every agent is on an unlimited plan with no boosts.
    houseBoost: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
    agentSubscription: { findMany: jest.fn(async () => []) },
    subscriptionPlan: {
      findUnique: jest.fn(async () => ({ id: 'plan_free', code: 'FREE', name: 'Free Basic', rank: 0, monthlyListingLimit: null, freeBoostDays: 0, badgeEligible: false, performanceLevel: 'BASIC', audienceInsights: false, monthlyReport: false }))
    },
    user: {
      findUnique: jest.fn(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        if (where.id !== 'user-normal') {
          return null;
        }

        const baseUser = {
          id: 'user-normal',
          name: 'Normal User',
          email: 'normal@example.com',
          phone: '091111111',
          verificationStatus: 'VERIFIED',
          userRoles: [{ role: { id: 'role-normal', name: 'normal' } }]
        };

        if (include) {
          return baseUser;
        }

        return baseUser;
      }),
      findMany: jest.fn(async () => []),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        name: 'Normal User',
        email: 'normal@example.com',
        phone: '091111111',
        verificationStatus: data.verificationStatus ?? 'PENDING',
        userRoles: [{ role: { id: 'role-agent', name: 'agent' } }]
      }))
    },
    role: {
      upsert: jest.fn(async ({ where, create }: { where: { name: string }; create: Record<string, unknown> }) => ({
        id: `role-${where.name}`,
        name: where.name,
        code: create.code ?? where.name,
        isActive: true
      }))
    },
    agentProfile: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => ({
        id: 'agent-profile-1',
        ...create
      }))
    },
    notification: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'notification-1',
        ...data,
        isRead: false,
        createdAt: new Date()
      }))
    },
    vehicleType: {
      findUnique: jest.fn(async () => ({ id: 'vt-1', isActive: true, name: '10 ft', maxLoadKg: 1000 }))
    },
    propertyType: {
      findMany: jest.fn(async () => [{ id: 'ptype-1', name: 'Apartment', isActive: true }])
    },
    house: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0)
    },
    ratingReview: {
      findMany: jest.fn(async () => [])
    }
  };

  return { prisma };
});

describe('Completion increment modules', () => {
  it('returns home page content publicly', async () => {
    const response = await request(app).get('/api/v1/home');

    expect(response.status).toBe(200);
    expect(response.body.data.featuredHouses).toBeDefined();
    expect(response.body.data.verifiedAgents).toBeDefined();
    expect(response.body.data.serviceReviews).toBeDefined();
  });

  it('returns active public master data', async () => {
    const response = await request(app).get('/api/v1/master-data/property-types');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
  });

  it('registers an agent profile for authenticated users', async () => {
    const response = await request(app)
      .post('/api/v1/registrations/agent')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        name: 'Agent Applicant',
        nrc: '12/YGN(N)123456',
        nrcFrontPhotoPath: 'uploads/docs/nrc-front.jpg',
        nrcBackPhotoPath: 'uploads/docs/nrc-back.jpg',
        email: 'agent@example.com',
        phone: '099999999',
        address1: 'Street 1',
        cityId: 'city-1',
        stateId: 'state-1',
        serviceRegionId: 'region-1',
        hasRentingExperience: true
      });

    expect(response.status).toBe(201);
    expect(response.body.data.profile.userId).toBe('user-normal');
  });
});
