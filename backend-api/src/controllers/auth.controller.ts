import { Request, Response } from 'express';

import { login, logout, refreshAccessToken, register, verifyAuthUser } from '../services/auth.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

export const registerController = async (req: Request, res: Response): Promise<void> => {
  const payload = await register({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    occupationId: req.body.occupationId,
    password: req.body.password
  });

  sendSuccess(res, 201, 'Registration successful', payload);
};

export const loginController = async (req: Request, res: Response): Promise<void> => {
  const payload = await login({
    email: req.body.email,
    password: req.body.password,
    rememberMe: Boolean(req.body.rememberMe)
  });

  sendSuccess(res, 200, 'Login successful', payload);
};

export const verifyController = async (req: Request, res: Response): Promise<void> => {
  const auth = req.auth;
  if (!auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  const user = await verifyAuthUser(auth.userId);
  sendSuccess(res, 200, 'Token is valid', { user });
};

export const meController = async (req: Request, res: Response): Promise<void> => {
  const auth = req.auth;
  if (!auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  const user = await verifyAuthUser(auth.userId);
  sendSuccess(res, 200, 'Authenticated user profile', { user });
};

export const refreshController = async (req: Request, res: Response): Promise<void> => {
  const payload = await refreshAccessToken(req.body.refreshToken);
  sendSuccess(res, 200, 'Token refreshed successfully', payload);
};

export const logoutController = async (req: Request, res: Response): Promise<void> => {
  await logout(req.body.refreshToken);
  sendSuccess(res, 200, 'Logout successful', { ok: true });
};
