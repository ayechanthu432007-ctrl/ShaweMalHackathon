import request from 'supertest';

// No real database in these tests: unknown emails, and a health check that succeeds.
jest.mock('../../src/prisma/client', () => ({
  prisma: {
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
    user: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
  },
}));

import { app } from '../../src/app';
import { getRateLimitStore, MemoryRateLimitStore, rateLimit, setRateLimitStore } from '../../src/middleware/rate-limit.middleware';

describe('security headers', () => {
  it('sends hardening headers and hides the framework', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    // Uploaded images are embedded by the web app, which is another origin.
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('request size limits', () => {
  it('refuses a JSON body over 100 KB before it reaches any handler', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(150_000) }));

    expect(response.status).toBe(413);
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    (getRateLimitStore() as MemoryRateLimitStore).clear();
  });

  it('stops repeated sign-in attempts for one account, but not for another', async () => {
    const attempt = (email: string) => request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password-1' });

    // The first 8 get through to the real handler (any answer but 429).
    for (let i = 0; i < 8; i += 1) {
      const response = await attempt('victim@example.com');
      expect(response.status).not.toBe(429);
    }

    const blocked = await attempt('victim@example.com');
    expect(blocked.status).toBe(429);
    expect(blocked.body.errors.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.headers['ratelimit-remaining']).toBe('0');

    // A different account from the same address is not locked out by it.
    const other = await attempt('someone-else@example.com');
    expect(other.status).not.toBe(429);
  });

  it('counts a window, then lets requests through again when it ends', async () => {
    const store = new MemoryRateLimitStore();
    jest.useFakeTimers({ now: Date.parse('2026-11-05T00:00:00.000Z') });
    try {
      const first = await store.increment('k', 1000);
      const second = await store.increment('k', 1000);
      expect([first.count, second.count]).toEqual([1, 2]);
      jest.setSystemTime(Date.parse('2026-11-05T00:00:01.500Z'));
      expect((await store.increment('k', 1000)).count).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps limits for different routes separate', async () => {
    const a = rateLimit({ name: 'route-a', windowMs: 60_000, max: 1 });
    const b = rateLimit({ name: 'route-b', windowMs: 60_000, max: 1 });
    const call = (handler: ReturnType<typeof rateLimit>) =>
      new Promise<unknown>((resolve) => {
        const res = { setHeader: jest.fn() } as never;
        void handler({ ip: '203.0.113.9', socket: {} } as never, res, (error?: unknown) => resolve(error));
      });

    expect(await call(a)).toBeUndefined();
    expect(await call(b)).toBeUndefined();
    expect(await call(a)).toMatchObject({ statusCode: 429 });
  });

  it('lets requests through, and says so, if the limit store breaks', async () => {
    const original = getRateLimitStore();
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    setRateLimitStore({
      kind: 'shared',
      increment: async () => {
        throw new Error('store down');
      },
    });
    try {
      const response = await request(app).get('/api/v1/health');
      expect(response.status).toBe(200);
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('Rate limit store failed'), expect.any(Error));
    } finally {
      setRateLimitStore(original);
      logged.mockRestore();
    }
  });
});
