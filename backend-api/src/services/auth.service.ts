import { ApiError } from '../utils/api-error';
import { prisma } from '../prisma/client';
import { comparePassword, hashPassword } from '../utils/password';
import { generateAccessToken } from './token.service';
import {
  createRefreshSession,
  getValidRefreshSessionByToken,
  isSessionUsable,
  revokeAllUserSessions,
  revokeRefreshSession
} from './session.service';
import { createUserWithDefaultRole, getUserByEmail, getUserById, toSafeUser, updateUserPassword } from './user.service';

interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

const hasPrismaDuplicateError = (error: unknown): error is { code: string } => {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
};

export const register = async (input: RegisterInput) => {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new ApiError(409, 'AUTH_EMAIL_EXISTS', 'Email is already registered.');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await createUserWithDefaultRole({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash
    });

    const safeUser = toSafeUser(user);

    const accessToken = generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        roles: safeUser.roles
      },
      false
    );

    const refresh = await createRefreshSession(user.id, false);

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Account Registration Confirmed',
        message: 'Your account registration has been confirmed successfully.'
      }
    });

    return {
      user: safeUser,
      accessToken,
      refreshToken: refresh.refreshToken
    };
  } catch (error) {
    if (hasPrismaDuplicateError(error)) {
      throw new ApiError(409, 'AUTH_DUPLICATE_FIELD', 'Email or phone already exists.');
    }

    throw error;
  }
};

export const login = async (input: LoginInput) => {
  const user = await getUserByEmail(input.email);
  if (!user) {
    throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const passwordMatched = await comparePassword(input.password, user.passwordHash);
  if (!passwordMatched) {
    throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (user.accountStatus === 'BANNED') {
    throw new ApiError(403, 'AUTH_ACCOUNT_BANNED', 'This account has been banned.');
  }

  if (user.accountStatus === 'SUSPENDED') {
    throw new ApiError(403, 'AUTH_ACCOUNT_SUSPENDED', 'This account is suspended. Please contact support.');
  }

  const safeUser = toSafeUser(user);
  const accessToken = generateAccessToken(
    {
      userId: user.id,
      email: user.email,
      roles: safeUser.roles
    },
    input.rememberMe
  );

  const refresh = await createRefreshSession(user.id, input.rememberMe);

  return {
    user: safeUser,
    accessToken,
    refreshToken: refresh.refreshToken
  };
};

export const verifyAuthUser = async (userId: string) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(401, 'AUTH_USER_NOT_FOUND', 'Authenticated user not found.');
  }

  return toSafeUser(user);
};

export const refreshAccessToken = async (refreshToken: string) => {
  const session = await getValidRefreshSessionByToken(refreshToken);
  if (!session || !isSessionUsable(session)) {
    throw new ApiError(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
  }

  const safeUser = toSafeUser(session.user);
  const accessToken = generateAccessToken(
    {
      userId: session.user.id,
      email: session.user.email,
      roles: safeUser.roles
    },
    session.rememberMe
  );

  const nextSession = await createRefreshSession(session.user.id, session.rememberMe);
  await revokeRefreshSession(session.id, nextSession.session.id);

  return {
    user: safeUser,
    accessToken,
    refreshToken: nextSession.refreshToken
  };
};

export const logout = async (refreshToken: string) => {
  const session = await getValidRefreshSessionByToken(refreshToken);
  if (!session || !isSessionUsable(session)) {
    return;
  }

  await revokeRefreshSession(session.id);
};

interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export const changePassword = async (input: ChangePasswordInput) => {
  const user = await getUserById(input.userId);
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const isCurrentPasswordValid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, 'PROFILE_INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
  }

  const nextPasswordHash = await hashPassword(input.newPassword);
  await updateUserPassword(input.userId, nextPasswordHash);
  await revokeAllUserSessions(input.userId);
};
