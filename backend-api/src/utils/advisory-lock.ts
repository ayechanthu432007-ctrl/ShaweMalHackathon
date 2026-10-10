import type { Prisma } from '@prisma/client';

/** Queued requests wait for the lock instead of failing, so allow more time than Prisma's 5s default. */
export const LOCKED_TRANSACTION_OPTIONS = { maxWait: 20_000, timeout: 20_000 } as const;

/**
 * Serialises transactions that share `key` (for example one agent's listing quota, or one
 * payment order). The lock is held until the surrounding transaction commits or rolls back,
 * so a check followed by a write cannot be interleaved with another request doing the same.
 */
export const lockForTransaction = async (tx: Prisma.TransactionClient, key: string): Promise<void> => {
  // $executeRaw: the function returns void, which $queryRaw cannot map to a result row.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
};
