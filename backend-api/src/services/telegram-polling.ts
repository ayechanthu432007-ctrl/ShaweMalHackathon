import {
  callTelegramApi,
  configureTelegramBotProfile,
  handleTelegramUpdate,
  isTelegramBotConfigured,
  type TelegramUpdate
} from './telegram-bot.service';

const POLL_TIMEOUT_SECONDS = 5;
const RETRY_DELAY_MS = 3000;

export type PollingStart = 'started' | 'not-configured' | 'webhook-active' | 'token-rejected' | 'unreachable';

/**
 * Local development only: receives updates by long polling so the bot answers without a
 * public webhook URL. Production (Vercel) uses POST /api/v1/telegram/webhook instead.
 *
 * Polling is refused by Telegram while a webhook is registered for the same token, and a
 * registered webhook is deliberately left alone. Log lines never include the token.
 */
export const startTelegramPolling = async (): Promise<PollingStart> => {
  if (!isTelegramBotConfigured()) {
    console.log('Telegram bot: disabled. Set TELEGRAM_BOT_TOKEN in backend-api/.env and restart to enable it.');
    return 'not-configured';
  }

  let username: string;
  try {
    const me = await callTelegramApi<{ username?: string }>('getMe', {});
    username = me.username ?? 'unknown';

    const webhook = await callTelegramApi<{ url?: string }>('getWebhookInfo', {});
    if (webhook.url) {
      console.log(`Telegram bot @${username}: a webhook is registered, so local polling is off and updates go to the deployed API.`);
      return 'webhook-active';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    if (message.includes('(401)') || message.includes('(404)')) {
      console.error('Telegram bot: Telegram rejected TELEGRAM_BOT_TOKEN. Check the value in backend-api/.env.');
      return 'token-rejected';
    }

    console.error(`Telegram bot: could not reach Telegram (${message}).`);
    return 'unreachable';
  }

  await configureTelegramBotProfile();
  console.log(`Telegram bot @${username}: polling for updates (local development).`);

  void (async () => {
    let offset = 0;
    for (;;) {
      try {
        const updates = await callTelegramApi<TelegramUpdate[]>('getUpdates', {
          offset,
          timeout: POLL_TIMEOUT_SECONDS,
          allowed_updates: ['message', 'callback_query']
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          await handleTelegramUpdate(update);
        }

        if (updates.length > 0) {
          // Count and kind only; message contents and chat ids are not logged.
          const kinds = updates.map((update) => (update.callback_query ? 'button' : 'message')).join(', ');
          console.log(`Telegram bot: handled ${updates.length} update(s): ${kinds}.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        if (message.includes('(409)')) {
          console.error('Telegram bot: polling stopped because another process or a webhook is receiving updates for this bot.');
          return;
        }

        console.error(`Telegram bot: polling failed, retrying (${message}).`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  })();

  return 'started';
};
