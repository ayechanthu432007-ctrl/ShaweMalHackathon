/**
 * Runs the Telegram bot on its own by long polling, without starting the API server.
 * `npm run dev` already does this in development; use this script only to run the bot alone.
 */
import { startTelegramPolling } from '../services/telegram-polling';

void startTelegramPolling().then((result) => {
  if (result !== 'started') {
    process.exit(1);
  }
});
