import bcrypt from 'bcryptjs';

import { env } from '../config/env';

export const hashPassword = async (plainPassword: string): Promise<string> => {
  return bcrypt.hash(plainPassword, env.bcryptSaltRounds);
};

let decoyHash: Promise<string> | null = null;

/**
 * Spends the same time as a real password check. Sign-in calls it when the email is unknown, so
 * the response time does not reveal which emails have accounts.
 */
export const spendPasswordCheckTime = async (plainPassword: string): Promise<void> => {
  decoyHash ??= bcrypt.hash('decoy-password-for-timing', env.bcryptSaltRounds);
  await bcrypt.compare(plainPassword, await decoyHash);
};

export const comparePassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};
