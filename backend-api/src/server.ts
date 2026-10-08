import { app } from './app';
import { env } from './config/env';
import { startTelegramPolling } from './services/telegram-polling';

app.listen(env.port, () => {
  console.log(`Backend API listening on port ${env.port}`);
});

// Local development has no public URL for a Telegram webhook, so the bot polls instead.
// The deployed API (api/index.ts) never runs this file and receives updates by webhook.
if (env.nodeEnv === 'development') {
  void startTelegramPolling();
}
