/**
 * Registers the production webhook with Telegram.
 * Usage: npm run telegram:set-webhook -- https://<your-api-host>/api/v1/telegram/webhook
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment; prints neither.
 */
import { env } from '../config/env';
import { callTelegramApi, configureTelegramBotProfile } from '../services/telegram-bot.service';

const main = async () => {
  const url = process.argv[2];
  if (!url || !/^https:\/\/[^\s]+\/api\/v1\/telegram\/webhook$/.test(url)) {
    console.error('Pass the public HTTPS webhook URL, e.g. https://api.example.com/api/v1/telegram/webhook');
    process.exit(1);
  }

  if (!env.telegramBotToken || !env.telegramWebhookSecret) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET before registering the webhook.');
    process.exit(1);
  }

  await callTelegramApi('setWebhook', {
    url,
    secret_token: env.telegramWebhookSecret,
    allowed_updates: ['message', 'callback_query']
  });

  await configureTelegramBotProfile();
  console.log(`Webhook registered for ${url}`);
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not register the webhook.');
  process.exit(1);
});
