import { timingSafeEqual } from 'node:crypto';

import { Request, Response } from 'express';

import { env } from '../config/env';
import { handleTelegramUpdate, type TelegramUpdate } from '../services/telegram-bot.service';
import { ApiError } from '../utils/api-error';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

const secretsMatch = (received: string, expected: string): boolean => {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const isTelegramUpdate = (body: unknown): body is TelegramUpdate => {
  return typeof body === 'object' && body !== null && Number.isInteger((body as { update_id?: unknown }).update_id);
};

export const telegramWebhookController = async (req: Request, res: Response): Promise<void> => {
  // Without a token and a webhook secret the endpoint does not exist.
  if (!env.telegramBotToken || !env.telegramWebhookSecret) {
    throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  }

  const received = req.header(SECRET_HEADER);
  if (!received || !secretsMatch(received, env.telegramWebhookSecret)) {
    throw new ApiError(401, 'TELEGRAM_WEBHOOK_UNAUTHORIZED', 'Invalid webhook credentials.');
  }

  if (!isTelegramUpdate(req.body)) {
    throw new ApiError(400, 'TELEGRAM_UPDATE_INVALID', 'Malformed update.');
  }

  // handleTelegramUpdate never throws; always answer 200 so Telegram does not retry the update.
  await handleTelegramUpdate(req.body);
  res.status(200).json({ ok: true });
};
