import { Router } from 'express';

import { telegramWebhookController } from '../../controllers/telegram.controller';
import { asyncHandler } from '../../utils/async-handler';

const telegramRouter = Router();

// Called by Telegram only; requests are authenticated with the webhook secret header.
telegramRouter.post('/webhook', asyncHandler(telegramWebhookController));

export { telegramRouter };
