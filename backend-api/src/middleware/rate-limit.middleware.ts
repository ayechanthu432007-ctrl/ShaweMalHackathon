import { NextFunction, Request, RequestHandler, Response } from 'express';

import { env } from '../config/env';
import { ApiError } from '../utils/api-error';

/**
 * Fixed-window rate limiting with a swappable store.
 *
 * The in-memory store counts per server instance. On a serverless host every instance counts
 * separately, so it is only a weak, best-effort guard there; a shared store (Redis) is what makes
 * limits real across instances. Production therefore announces loudly when it is running without one.
 */
export interface RateLimitHit {
  count: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
}

export interface RateLimitStore {
  readonly kind: 'memory' | 'shared';
  increment(key: string, windowMs: number): Promise<RateLimitHit>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = 'memory' as const;
  private readonly hits = new Map<string, RateLimitHit>();
  private lastSweep = Date.now();

  async increment(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    this.sweep(now);
    const current = this.hits.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, fresh);
      return { ...fresh };
    }
    current.count += 1;
    return { ...current };
  }

  /** Drops expired windows so the map cannot grow without bound. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000 && this.hits.size < 10_000) return;
    this.lastSweep = now;
    for (const [key, hit] of this.hits) {
      if (hit.resetAt <= now) this.hits.delete(key);
    }
  }

  clear() {
    this.hits.clear();
  }
}

let activeStore: RateLimitStore = new MemoryRateLimitStore();
let warnedAboutMemory = false;

export const setRateLimitStore = (store: RateLimitStore) => {
  activeStore = store;
};
export const getRateLimitStore = () => activeStore;

const warnIfWeakInProduction = () => {
  if (warnedAboutMemory || activeStore.kind !== 'memory' || env.nodeEnv !== 'production') return;
  warnedAboutMemory = true;
  console.error(
    '[security] Rate limiting is using the PER-INSTANCE memory store in production. Limits are not shared across serverless instances. Configure a shared store (Redis) to enforce them properly.'
  );
};

export interface RateLimitOptions {
  /** Stable name, part of the storage key, so limits for different routes never mix. */
  name: string;
  windowMs: number;
  max: number;
  /** Extra identity besides the client IP, such as the email being signed in to. */
  keyPart?: (req: Request) => string | undefined;
  message?: string;
}

export const clientIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

export const rateLimit = (options: RateLimitOptions): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      warnIfWeakInProduction();
      const part = options.keyPart?.(req);
      const key = `rl:${options.name}:${clientIp(req)}${part ? `:${part}` : ''}`;
      const hit = await activeStore.increment(key, options.windowMs);
      const remaining = Math.max(0, options.max - hit.count);
      res.setHeader('RateLimit-Limit', String(options.max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((hit.resetAt - Date.now()) / 1000))));

      if (hit.count > options.max) {
        const retryAfter = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        next(new ApiError(429, 'RATE_LIMITED', options.message ?? 'Too many requests. Please wait a moment and try again.'));
        return;
      }
      next();
    } catch (error) {
      // A broken limiter store must not take the API down; the failure is logged, never silent.
      console.error('[security] Rate limit store failed; letting the request through', error);
      next();
    }
  };
};

const normalizedEmail = (req: Request): string | undefined => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email ? email.trim().toLowerCase().slice(0, 254) : undefined;
};

const MINUTE = 60_000;

/** The limits applied to the API. Chosen to stop abuse without bothering shared (NAT) networks. */
export const limits = {
  /** Every API request, per client IP. Generous: this only stops floods. */
  global: rateLimit({ name: 'global', windowMs: MINUTE, max: 600 }),
  /** Password guessing: per IP+email, and per IP overall. */
  loginPerAccount: rateLimit({
    name: 'login-account',
    windowMs: 15 * MINUTE,
    max: 8,
    keyPart: normalizedEmail,
    message: 'Too many sign-in attempts for this account. Please wait a few minutes and try again.',
  }),
  loginPerIp: rateLimit({ name: 'login-ip', windowMs: 15 * MINUTE, max: 40, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' }),
  register: rateLimit({ name: 'register', windowMs: 60 * MINUTE, max: 15, message: 'Too many sign-up attempts. Please try again later.' }),
  refresh: rateLimit({ name: 'refresh', windowMs: 15 * MINUTE, max: 120 }),
  /** Image uploads are the heaviest requests (memory and image processing). */
  upload: rateLimit({ name: 'upload', windowMs: 15 * MINUTE, max: 60 }),
};
