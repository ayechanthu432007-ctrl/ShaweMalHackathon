import type { PoolConfig } from 'pg';

export type DatabaseTarget = 'local' | 'supabase';

export interface ResolvedDatabaseUrls {
  target: DatabaseTarget;
  databaseUrl: string;
  directUrl: string;
}

const parseTarget = (value: string | undefined): DatabaseTarget => {
  const target = (value ?? 'local').trim().toLowerCase();
  if (target === 'local' || target === 'supabase') {
    return target;
  }

  throw new Error('DATABASE_TARGET must be "local" or "supabase".');
};

const appendQueryParam = (connectionString: string, key: string, value: string): string => {
  if (new RegExp(`[?&]${key}=`, 'i').test(connectionString)) {
    return connectionString;
  }

  return connectionString.includes('?')
    ? `${connectionString}&${key}=${value}`
    : `${connectionString}?${key}=${value}`;
};

const ensureSslMode = (connectionString: string): string => {
  // Node pg currently treats sslmode=require as verify-full. uselibpqcompat restores
  // encrypt-only "require" so pooler TLS works behind local SSL inspection.
  return appendQueryParam(appendQueryParam(connectionString, 'uselibpqcompat', 'true'), 'sslmode', 'require');
};

/**
 * Pool config for `@prisma/adapter-pg`.
 * On Vercel, keep `max: 1` so each serverless isolate does not open a large pool.
 */
export const toPrismaPgConfig = (
  connectionString: string,
  target: DatabaseTarget,
  source: NodeJS.ProcessEnv = process.env
): PoolConfig => {
  const isServerless = Boolean(source.VERCEL);
  const config: PoolConfig = {
    connectionString: target === 'supabase' ? ensureSslMode(connectionString) : connectionString,
    max: isServerless ? 1 : 10,
    idleTimeoutMillis: isServerless ? 10_000 : 30_000,
    // With a single connection per serverless instance, simultaneous requests queue for it.
    // Wait for the queue (the function limit is 30s) instead of failing after 10s.
    connectionTimeoutMillis: isServerless ? 25_000 : 10_000
  };

  if (target === 'supabase') {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
};

export const resolveDatabaseUrls = (
  source: NodeJS.ProcessEnv = process.env
): ResolvedDatabaseUrls => {
  const target = parseTarget(source.DATABASE_TARGET);

  if (target === 'local') {
    const databaseUrl = source.LOCAL_DATABASE_URL || source.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        'Missing local database URL. Set LOCAL_DATABASE_URL or DATABASE_URL when DATABASE_TARGET=local.'
      );
    }

    return {
      target,
      databaseUrl,
      directUrl: databaseUrl
    };
  }

  const databaseUrl = source.SUPABASE_DATABASE_URL;
  const directUrl = source.SUPABASE_DIRECT_URL;
  if (!databaseUrl || !directUrl) {
    throw new Error(
      'Missing Supabase database URLs. Set SUPABASE_DATABASE_URL and SUPABASE_DIRECT_URL when DATABASE_TARGET=supabase.'
    );
  }

  return {
    target,
    databaseUrl: ensureSslMode(databaseUrl),
    directUrl: ensureSslMode(directUrl)
  };
};
