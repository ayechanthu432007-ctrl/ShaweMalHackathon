import bcrypt from 'bcryptjs';
import request from 'supertest';

import { app } from '../../src/app';

interface MockRole {
  id: string;
  name: string;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  userRoles: Array<{ role: MockRole }>;
}

interface MockRefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  rememberMe: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

interface FindUniqueUserArgs {
  where: { id?: string; email?: string };
}

const users = new Map<string, MockUser>();
const roles = new Map<string, MockRole>([
  ['normal', { id: 'role-normal', name: 'normal' }],
  ['admin', { id: 'role-admin', name: 'admin' }],
  ['agent', { id: 'role-agent', name: 'agent' }],
  ['driver', { id: 'role-driver', name: 'driver' }]
]);
const refreshSessions = new Map<string, MockRefreshSession>();

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  userRoles: user.userRoles.map((entry) => ({ role: { ...entry.role } }))
});

const pickUserByEmail = (email: string): MockUser | undefined => {
  return Array.from(users.values()).find((item) => item.email === email);
};

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: FindUniqueUserArgs) => {
        if (where.email) {
          const byEmail = pickUserByEmail(where.email);
          return byEmail ? cloneUser(byEmail) : null;
        }

        if (where.id) {
          const byId = users.get(where.id);
          return byId ? cloneUser(byId) : null;
        }

        return null;
      }),
      create: jest.fn(
        async ({
          data
        }: {
          data: { name: string; email: string; phone: string; passwordHash: string; userRoles: { create: Array<{ roleId: string }> } };
        }) => {
          if (pickUserByEmail(data.email) || Array.from(users.values()).find((item) => item.phone === data.phone)) {
            const duplicate = new Error('Duplicate') as Error & { code?: string };
            duplicate.code = 'P2002';
            throw duplicate;
          }

          const createdRoles = data.userRoles.create.map((entry) => {
            const role = Array.from(roles.values()).find((item) => item.id === entry.roleId);
            if (!role) {
              throw new Error('Role not found');
            }

            return { role };
          });

          const created: MockUser = {
            id: `user-${users.size + 1}`,
            name: data.name,
            email: data.email,
            phone: data.phone,
            passwordHash: data.passwordHash,
            verificationStatus: 'PENDING',
            userRoles: createdRoles
          };

          users.set(created.id, created);
          return cloneUser(created);
        }
      ),
      update: jest.fn(
        async ({
          where,
          data
        }: {
          where: { id: string };
          data: { passwordHash?: string; verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' };
        }) => {
          const found = users.get(where.id);
          if (!found) {
            throw new Error('User not found');
          }

          if (data.passwordHash) {
            found.passwordHash = data.passwordHash;
          }

          if (data.verificationStatus) {
            found.verificationStatus = data.verificationStatus;
          }

          users.set(found.id, found);
          return cloneUser(found);
        }
      )
    },
    role: {
      upsert: jest.fn(async ({ where, create }: { where: { name: string }; create: { name: string } }) => {
        const found = roles.get(where.name);
        if (found) {
          return found;
        }

        const role = { id: `role-${create.name}`, name: create.name };
        roles.set(create.name, role);
        return role;
      }),
      findMany: jest.fn(async ({ where }: { where: { name: { in: string[] } } }) => {
        return where.name.in.map((name) => roles.get(name)).filter((item): item is MockRole => Boolean(item));
      })
    },
    userRole: {
      deleteMany: jest.fn(async () => ({ count: 1 })),
      createMany: jest.fn(async () => ({ count: 1 }))
    },
    notification: {
      create: jest.fn(async () => ({ id: 'notification-1' }))
    },
    refreshSession: {
      create: jest.fn(async ({ data }: { data: { userId: string; tokenHash: string; rememberMe: boolean; expiresAt: Date } }) => {
        const created: MockRefreshSession = {
          id: `session-${refreshSessions.size + 1}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          rememberMe: data.rememberMe,
          expiresAt: data.expiresAt,
          revokedAt: null,
          replacedById: null
        };

        refreshSessions.set(created.id, created);
        return created;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const session = Array.from(refreshSessions.values()).find((item) => item.tokenHash === where.tokenHash);
        if (!session) {
          return null;
        }

        const user = users.get(session.userId);
        if (!user) {
          return null;
        }

        return {
          ...session,
          user: cloneUser(user)
        };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { revokedAt?: Date; replacedById?: string } }) => {
        const found = refreshSessions.get(where.id);
        if (!found) {
          throw new Error('Session not found');
        }

        if (data.revokedAt) {
          found.revokedAt = data.revokedAt;
        }

        if (data.replacedById) {
          found.replacedById = data.replacedById;
        }

        refreshSessions.set(found.id, found);
        return found;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
        let count = 0;

        refreshSessions.forEach((session, key) => {
          if (session.userId === where.userId && session.revokedAt === where.revokedAt) {
            refreshSessions.set(key, { ...session, revokedAt: data.revokedAt });
            count += 1;
          }
        });

        return { count };
      })
    },
    auditLog: {
      create: jest.fn(async () => ({ id: 'audit-1' }))
    },
    propertyType: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      create: jest.fn(),
      update: jest.fn()
    },
    state: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    city: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    contractType: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    vehicleType: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    serviceRegion: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    floorLevel: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    occupation: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === 'occ-student' ? { id: where.id } : null)),
      create: jest.fn(),
      update: jest.fn()
    },
    amenity: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    statusCode: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> => callback(prisma))
  };

  return { prisma };
});

describe('Auth and profile routes', () => {
  beforeEach(() => {
    users.clear();
    refreshSessions.clear();
  });

  it('refuses to register without an occupation, or with one that does not exist', async () => {
    const account = { name: 'No Job', email: 'nojob@example.com', phone: '0911111111', password: 'Passw0rd!', confirmPassword: 'Passw0rd!' };

    const missing = await request(app).post('/api/v1/auth/register').send(account);
    const unknown = await request(app).post('/api/v1/auth/register').send({ ...account, occupationId: 'occ-unknown' });

    expect(missing.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors.code).toBe('OCCUPATION_INVALID');
  });

  it('registers successfully and returns refresh token', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '0912345678',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
      occupationId: 'occ-student'
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('john@example.com');
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
  });

  it('refreshes and rotates refresh token', async () => {
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'Token User',
      email: 'token@example.com',
      phone: '0977777777',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
      occupationId: 'occ-student'
    });

    const refreshToken = registerResponse.body.data.refreshToken as string;
    const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
    expect(response.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('logs out and revokes session', async () => {
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'Logout User',
      email: 'logout@example.com',
      phone: '0988888888',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
      occupationId: 'occ-student'
    });

    const refreshToken = registerResponse.body.data.refreshToken as string;

    const logoutResponse = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);

    const refreshAfterLogout = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.success).toBe(false);
  });

  it('returns authenticated user with /me', async () => {
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'Me User',
      email: 'me@example.com',
      phone: '0966666666',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
      occupationId: 'occ-student'
    });

    const token = registerResponse.body.data.accessToken as string;

    const meResponse = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.success).toBe(true);
    expect(meResponse.body.data.user.email).toBe('me@example.com');
  });

  it('changes password and invalidates old password login', async () => {
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'Password User',
      email: 'pw@example.com',
      phone: '0955555555',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
      occupationId: 'occ-student'
    });

    const token = registerResponse.body.data.accessToken as string;

    const changeResponse = await request(app)
      .patch('/api/v1/profile/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'Passw0rd!',
        newPassword: 'N3wPassw0rd!',
        confirmNewPassword: 'N3wPassw0rd!'
      });

    expect(changeResponse.status).toBe(200);

    const oldLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'pw@example.com',
      password: 'Passw0rd!'
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'pw@example.com',
      password: 'N3wPassw0rd!'
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);
  });

  it('blocks non-admin from admin routes', async () => {
    const hashed = await bcrypt.hash('Passw0rd!', 4);

    users.set('normal-1', {
      id: 'normal-1',
      name: 'Normal User',
      email: 'normal@example.com',
      phone: '0933333333',
      passwordHash: hashed,
      verificationStatus: 'PENDING',
      userRoles: [{ role: { id: 'role-normal', name: 'normal' } }]
    });

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'normal@example.com',
      password: 'Passw0rd!'
    });

    const token = loginResponse.body.data.accessToken as string;

    const response = await request(app).post('/api/v1/admin/users').set('Authorization', `Bearer ${token}`).send({
      name: 'Another User',
      email: 'another@example.com',
      phone: '0922222222',
      password: 'Passw0rd!',
      role: 'normal'
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
