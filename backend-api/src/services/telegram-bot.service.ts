import { env } from '../config/env';
import {
  FAQ_ENTRIES,
  findFaqById,
  GENERIC_ERROR_MESSAGE,
  MAIN_MENU_LABEL,
  matchFaq,
  notUnderstoodMessage,
  WELCOME_MESSAGE,
  type FaqEntry
} from './telegram-faq';

type InlineButton = { text: string; url: string } | { text: string; callback_data: string };

type InlineKeyboard = InlineButton[][];

/** The parts of a Telegram update this bot reads. Everything else is ignored. */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat?: { id?: number; type?: string };
    text?: string;
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: { chat?: { id?: number } };
  };
}

const FAQ_CALLBACK_PREFIX = 'faq:';
const MENU_CALLBACK = 'menu';
const TELEGRAM_TIMEOUT_MS = 8000;

export const isTelegramBotConfigured = (): boolean => Boolean(env.telegramBotToken);

/**
 * Calls the Telegram Bot API. The token lives in the request URL, so errors are reported
 * by method name and Telegram's own description only — never the URL.
 */
export const callTelegramApi = async <T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> => {
  if (!env.telegramBotToken) {
    throw new Error('Telegram bot is not configured.');
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
    });
  } catch (error) {
    // The original error is deliberately not attached as `cause`: it can carry the request URL, which contains the token.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Telegram ${method} request failed: ${error instanceof Error ? error.name : 'network error'}`);
  }

  const body = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!response.ok || !body?.ok) {
    throw new Error(`Telegram ${method} failed (${response.status}): ${body?.description ?? 'no description'}`);
  }

  return body.result as T;
};

/** Telegram refuses URL buttons that are not public http(s) links (for example localhost). */
const isPublicUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const isLocal = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127\./.test(url.hostname);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !isLocal && url.hostname.includes('.');
  } catch {
    return false;
  }
};

const websiteUrl = (path: string): string | null => {
  if (!env.websiteUrl) {
    return null;
  }

  return `${env.websiteUrl.replace(/\/+$/, '')}${path}`;
};

const mainMenuKeyboard = (): InlineKeyboard =>
  FAQ_ENTRIES.map((entry) => [{ text: entry.question, callback_data: `${FAQ_CALLBACK_PREFIX}${entry.id}` }]);

const backToMenuRow = (): InlineButton[] => [{ text: MAIN_MENU_LABEL, callback_data: MENU_CALLBACK }];

let warnedAboutWebsiteUrl = false;

export const buildFaqReply = (entry: FaqEntry): { text: string; keyboard: InlineKeyboard } => {
  const keyboard: InlineKeyboard = [];
  const text = entry.answer;

  if (entry.id === 'contact') {
    for (const username of env.telegramSupportUsernames) {
      keyboard.push([{ text: `💬 @${username}`, url: `https://t.me/${username}` }]);
    }
  }

  if (entry.link) {
    const url = websiteUrl(entry.link.path);
    if (url && isPublicUrl(url)) {
      // The address is only ever the button's target; it is never written into the message text.
      keyboard.push([{ text: entry.link.label, url }]);
    } else if (!warnedAboutWebsiteUrl) {
      // Telegram refuses link buttons to localhost, so there is nothing clickable to offer.
      warnedAboutWebsiteUrl = true;
      console.warn('Telegram bot: website buttons are hidden because WEBSITE_URL is not a public http(s) address.');
    }
  }

  keyboard.push(backToMenuRow());
  return { text, keyboard };
};

const sendMessage = (chatId: number, text: string, keyboard: InlineKeyboard) =>
  callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: keyboard },
    link_preview_options: { is_disabled: true }
  });

const sendMainMenu = (chatId: number) => sendMessage(chatId, WELCOME_MESSAGE, mainMenuKeyboard());

const sendFaq = (chatId: number, entry: FaqEntry) => {
  const reply = buildFaqReply(entry);
  return sendMessage(chatId, reply.text, reply.keyboard);
};

const handleText = async (chatId: number, text: string) => {
  const trimmed = text.trim();
  const command = trimmed.startsWith('/') ? trimmed.split(/[\s@]/)[0]?.toLowerCase() : null;

  if (command === '/start' || command === '/menu' || command === '/help') {
    await sendMainMenu(chatId);
    return;
  }

  const entry = command ? undefined : matchFaq(trimmed);
  if (entry) {
    await sendFaq(chatId, entry);
    return;
  }

  await sendMessage(chatId, notUnderstoodMessage(env.telegramSupportUsernames), mainMenuKeyboard());
};

const handleCallback = async (callbackId: string, chatId: number | undefined, data: string | undefined) => {
  // Always acknowledge so the button stops showing its loading state.
  await callTelegramApi('answerCallbackQuery', { callback_query_id: callbackId }).catch(() => undefined);

  if (typeof chatId !== 'number') {
    return;
  }

  const entry = data?.startsWith(FAQ_CALLBACK_PREFIX) ? findFaqById(data.slice(FAQ_CALLBACK_PREFIX.length)) : undefined;
  if (entry) {
    await sendFaq(chatId, entry);
    return;
  }

  // "menu" and any unknown or tampered callback data fall back to the main menu.
  await sendMainMenu(chatId);
};

/** Shown by Telegram in the empty chat, above its own START button, before a user has started the bot. */
const BOT_DESCRIPTION = 'Shawe Mal အကြောင်း သိလိုတာတွေကို မေးမြန်းနိုင်ပါတယ်။ စတင်ရန် အောက်က START ကို နှိပ်ပါ။';
const BOT_SHORT_DESCRIPTION = 'Shawe Mal — အိမ်ရှာ၊ အခန်းဖော်ရှာ၊ အိမ်ပြောင်းနဲ့ Marketplace အတွက် FAQ Bot';

/**
 * Registers the bot's command list and the texts Telegram shows around its native START
 * button. Telegram does not let a bot message a user first, so this is the supported way
 * to shape the first screen. Safe to call repeatedly; failures are logged and ignored.
 */
export const configureTelegramBotProfile = async (): Promise<void> => {
  try {
    await callTelegramApi('setMyCommands', {
      commands: [
        { command: 'start', description: 'စတင်ရန် / ပင်မ Menu' },
        { command: 'menu', description: 'FAQ Menu ပြရန်' }
      ]
    });
    await callTelegramApi('setMyDescription', { description: BOT_DESCRIPTION });
    await callTelegramApi('setMyShortDescription', { short_description: BOT_SHORT_DESCRIPTION });
  } catch (error) {
    console.error(`Telegram bot: could not update the bot profile (${error instanceof Error ? error.message : 'unknown error'}).`);
  }
};

/**
 * Handles one Telegram update. Never throws: failures are logged without secrets and the
 * user gets a friendly Myanmar-language fallback where possible.
 */
export const handleTelegramUpdate = async (update: TelegramUpdate): Promise<void> => {
  const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;

  try {
    if (update.callback_query?.id) {
      await handleCallback(update.callback_query.id, chatId, update.callback_query.data);
      return;
    }

    // The FAQ bot only talks in private chats; group messages and non-text updates are ignored.
    if (typeof chatId !== 'number' || update.message?.chat?.type !== 'private') {
      return;
    }

    if (typeof update.message.text === 'string') {
      await handleText(chatId, update.message.text);
      return;
    }

    await sendMessage(chatId, notUnderstoodMessage(env.telegramSupportUsernames), mainMenuKeyboard());
  } catch (error) {
    console.error('Telegram update handling failed', {
      updateId: update.update_id,
      message: error instanceof Error ? error.message : 'unknown error'
    });

    if (typeof chatId === 'number') {
      await callTelegramApi('sendMessage', { chat_id: chatId, text: GENERIC_ERROR_MESSAGE }).catch(() => undefined);
    }
  }
};
