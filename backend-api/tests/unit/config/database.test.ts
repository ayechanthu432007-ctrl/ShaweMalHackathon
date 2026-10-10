import { resolveDatabaseUrls, toPrismaPgConfig } from '../../../src/config/database';

describe('resolveDatabaseUrls', () => {
  it('defaults to local and accepts DATABASE_URL as an alias', () => {
    const resolved = resolveDatabaseUrls({
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/shawemal'
    });

    expect(resolved).toEqual({
      target: 'local',
      databaseUrl: 'postgresql://postgres:secret@localhost:5432/shawemal',
      directUrl: 'postgresql://postgres:secret@localhost:5432/shawemal'
    });
  });

  it('prefers LOCAL_DATABASE_URL when DATABASE_TARGET is local', () => {
    const resolved = resolveDatabaseUrls({
      DATABASE_TARGET: 'local',
      LOCAL_DATABASE_URL: 'postgresql://postgres:local@localhost:5432/shawemal',
      DATABASE_URL: 'postgresql://postgres:alias@localhost:5432/shawemal'
    });

    expect(resolved.databaseUrl).toBe('postgresql://postgres:local@localhost:5432/shawemal');
  });

  it('requires both Supabase URLs and appends sslmode', () => {
    const resolved = resolveDatabaseUrls({
      DATABASE_TARGET: 'supabase',
      SUPABASE_DATABASE_URL: 'postgresql://postgres.ref:secret@aws-0-ap.pooler.supabase.com:5432/postgres',
      SUPABASE_DIRECT_URL: 'postgresql://postgres:secret@db.ref.supabase.co:5432/postgres'
    });

    expect(resolved.target).toBe('supabase');
    expect(resolved.databaseUrl).toContain('sslmode=require');
    expect(resolved.databaseUrl).toContain('uselibpqcompat=true');
    expect(resolved.directUrl).toContain('sslmode=require');
    expect(resolved.directUrl).toContain('uselibpqcompat=true');
  });

  it('throws when supabase URLs are missing', () => {
    expect(() =>
      resolveDatabaseUrls({
        DATABASE_TARGET: 'supabase',
        SUPABASE_DATABASE_URL: 'postgresql://postgres.ref:secret@pooler/postgres'
      })
    ).toThrow(/SUPABASE_DIRECT_URL/);
  });
});

describe('toPrismaPgConfig', () => {
  it('uses a single connection on Vercel', () => {
    const config = toPrismaPgConfig(
      'postgresql://postgres:secret@localhost:5432/shawemal',
      'local',
      { VERCEL: '1' }
    );

    expect(config.max).toBe(1);
    // Requests queue for the single connection, so they wait longer than a local pool would.
    expect(config.connectionTimeoutMillis).toBe(25_000);
    expect(toPrismaPgConfig('postgresql://postgres:secret@localhost:5432/shawemal', 'local', {}).connectionTimeoutMillis).toBe(10_000);
  });

  it('enables ssl for supabase targets', () => {
    const config = toPrismaPgConfig(
      'postgresql://postgres.ref:secret@aws-0-ap.pooler.supabase.com:5432/postgres',
      'supabase',
      {}
    );

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config.connectionString).toContain('sslmode=require');
  });
});
