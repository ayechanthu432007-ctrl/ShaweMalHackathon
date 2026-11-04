import compression from 'compression';
import { Express, RequestHandler } from 'express';
import helmet from 'helmet';

import { env } from '../config/env';

/**
 * Security headers for an API that is called from another origin (the web app) and also serves
 * uploaded images that the app embeds. `cross-origin` resource policy keeps those images loading.
 * The API returns JSON and images only, so the default content security policy (no scripts) fits.
 */
export const securityHeaders = (): RequestHandler =>
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // The web app reads responses by fetch, which the CORS allowlist already governs.
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  });

/**
 * Vercel compresses responses at its edge (verified: the live API answers with gzip), so doing it
 * again in the function only costs CPU. Elsewhere (a plain Node host) it is worth having.
 */
export const maybeCompression = (): RequestHandler | null => (process.env.VERCEL ? null : compression());

/**
 * How many proxies sit in front of the app, so `req.ip` is the real client and not the proxy.
 * Vercel puts exactly one in front. Without this, every visitor looks like one IP and the rate
 * limits would block everyone together, or a spoofed X-Forwarded-For could dodge them.
 */
export const configureProxyTrust = (app: Express) => {
  const configured = process.env.TRUST_PROXY;
  if (configured !== undefined && configured !== '') {
    const hops = Number(configured);
    app.set('trust proxy', Number.isInteger(hops) && hops >= 0 ? hops : configured);
    return;
  }
  if (process.env.VERCEL || env.nodeEnv === 'production') app.set('trust proxy', 1);
};

/** Production should name its web origin(s); `*` reflects any origin while allowing credentials. */
export const warnAboutOpenCors = () => {
  if (env.nodeEnv === 'production' && (!env.corsOrigin || env.corsOrigin.trim() === '*')) {
    console.error('[security] CORS_ORIGIN is unset or "*" in production: any website may call this API with credentials. Set it to your web origin(s).');
  }
};
