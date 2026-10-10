import dotenv from 'dotenv';

import { DEFAULT_UPLOAD_ALLOWED_MIME } from '../utils/upload-path';
import { resolveDatabaseUrls } from './database';
import { parseBlobStoreAccess, parseStorageDriver } from './storage-driver';
import { resolveUploadRoot } from './upload-root';

dotenv.config();

type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

const ALLOWED_ALGORITHMS: JwtAlgorithm[] = ['HS256', 'HS384', 'HS512'];

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('BCRYPT_SALT_ROUNDS must be a positive integer.');
  }

  return parsed;
};

const parsePositiveInt = (value: string | undefined, fallback: number, key: string): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const jwtAlgorithmRaw = process.env.JWT_ALGORITHM ?? 'HS256';
if (!ALLOWED_ALGORITHMS.includes(jwtAlgorithmRaw as JwtAlgorithm)) {
  throw new Error(`Unsupported JWT_ALGORITHM: ${jwtAlgorithmRaw}`);
}

const database = resolveDatabaseUrls();
const storageDriver = parseStorageDriver(process.env.STORAGE_DRIVER);
const blobStoreAccess = parseBlobStoreAccess(process.env.BLOB_STORE_ACCESS);
const uploadAllowedMime = (process.env.UPLOAD_ALLOWED_MIME ?? DEFAULT_UPLOAD_ALLOWED_MIME.join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const TELEGRAM_USERNAME_REGEX = /^[A-Za-z0-9_]{4,32}$/;
const TELEGRAM_WEBHOOK_SECRET_REGEX = /^[A-Za-z0-9_-]{16,256}$/;

/** Public Telegram accounts users are pointed to for questions the FAQ cannot answer. */
const telegramSupportUsernames = (process.env.TELEGRAM_SUPPORT_USERNAMES ?? 'aye432007,sforshein')
  .split(',')
  .map((item) => item.trim().replace(/^@/, ''))
  .filter(Boolean);
if (telegramSupportUsernames.some((username) => !TELEGRAM_USERNAME_REGEX.test(username))) {
  throw new Error('TELEGRAM_SUPPORT_USERNAMES must be a comma-separated list of Telegram usernames.');
}

const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
if (telegramWebhookSecret && !TELEGRAM_WEBHOOK_SECRET_REGEX.test(telegramWebhookSecret)) {
  throw new Error('TELEGRAM_WEBHOOK_SECRET must be 16-256 characters of A-Z, a-z, 0-9, _ or -.');
}

/** Public website address used in Telegram link buttons; defaults to the first allowed frontend origin. */
const firstCorsOrigin = (process.env.CORS_ORIGIN ?? '').split(',')[0]?.trim() ?? '';
const websiteUrl = process.env.WEBSITE_URL?.trim() || (firstCorsOrigin && firstCorsOrigin !== '*' ? firstCorsOrigin : null);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseTarget: database.target,
  databaseUrl: database.databaseUrl,
  databaseDirectUrl: database.directUrl,
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  jwtAlgorithm: jwtAlgorithmRaw as JwtAlgorithm,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 12),
  storageDriver,
  blobStoreAccess,
  uploadRoot: resolveUploadRoot(),
  uploadMaxBytes: parsePositiveInt(process.env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024, 'UPLOAD_MAX_BYTES'),
  uploadAllowedMime,
  // Server-side only. Never send these to the browser or write them to logs.
  // Simulated checkout for demos. Ignored in production even when set.
  demoPaymentsEnabled: process.env.DEMO_PAYMENTS_ENABLED === 'true' && (process.env.NODE_ENV ?? 'development') !== 'production',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
  telegramWebhookSecret,
  telegramSupportUsernames,
  websiteUrl
} as const;
