import type { Express } from 'express';
import request from 'supertest';

const BOT_TOKEN = '123456:TEST-TOKEN-not-real';
const WEBHOOK_SECRET = 'test-webhook-secret-0123456789';
const WEBHOOK_PATH = '/api/v1/telegram/webhook';

type TelegramCall = { url: string; method: string; payload: any };

describe('Telegram FAQ bot webhook', () => {
  let app: Express;
  let calls: TelegramCall[];
  let consoleError: jest.SpyInstance;
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TELEGRAM_SUPPORT_USERNAMES = 'aye432007,sforshein';
    process.env.WEBSITE_URL = 'https://shawemal.example.com/';
    // Loaded after the environment is set, because config is read at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require('../../src/app').app;
  });

  beforeEach(() => {
    calls = [];
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (input: any, init?: any) => {
      const url = String(input);
      calls.push({ url, method: url.split('/').pop() ?? '', payload: JSON.parse(init?.body ?? '{}') });
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const send = (body: unknown, secret: string | null = WEBHOOK_SECRET) => {
    const req = request(app).post(WEBHOOK_PATH);
    if (secret !== null) req.set('X-Telegram-Bot-Api-Secret-Token', secret);
    return req.send(body as object);
  };

  const textUpdate = (text: string, type = 'private') => ({
    update_id: 1,
    message: { chat: { id: 555, type }, text }
  });

  const callbackUpdate = (data: string) => ({
    update_id: 2,
    callback_query: { id: 'cb-1', data, message: { chat: { id: 555 } } }
  });

  const sentMessages = () => calls.filter((call) => call.method === 'sendMessage').map((call) => call.payload);
  const buttons = (payload: any): any[] => (payload.reply_markup?.inline_keyboard ?? []).flat();

  it('rejects requests without the correct webhook secret', async () => {
    expect((await send(textUpdate('/start'), null)).status).toBe(401);
    expect((await send(textUpdate('/start'), 'wrong-secret-wrong-secret-0000')).status).toBe(401);
    expect((await send(textUpdate('/start'), `${WEBHOOK_SECRET}x`)).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('rejects malformed updates and never echoes secrets', async () => {
    for (const body of [{}, { update_id: 'abc' }, [1, 2, 3]]) {
      const response = await send(body);
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).not.toContain(BOT_TOKEN);
      expect(JSON.stringify(response.body)).not.toContain(WEBHOOK_SECRET);
    }

    const invalidJson = await request(app)
      .post(WEBHOOK_PATH)
      .set('X-Telegram-Bot-Api-Secret-Token', WEBHOOK_SECRET)
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(invalidJson.status).toBeGreaterThanOrEqual(400);
    expect(calls).toHaveLength(0);
  });

  it('answers /start with the welcome text and the six FAQ buttons', async () => {
    const response = await send(textUpdate('/start'));
    expect(response.status).toBe(200);

    const [message] = sentMessages();
    expect(message.chat_id).toBe(555);
    expect(message.text).toContain('မင်္ဂလာပါ 👋');
    expect(message.text).toContain('Shawe Mal မှ ကြိုဆိုပါတယ်။');
    expect(buttons(message).map((button) => button.callback_data)).toEqual([
      'faq:rental',
      'faq:roommate',
      'faq:moving',
      'faq:marketplace',
      'faq:trust',
      'faq:contact'
    ]);
  });

  it('answers each FAQ button with its answer, the real website page and a main menu button', async () => {
    const expected: Array<[string, string, string | null]> = [
      ['rental', '🏠 အိမ်ရှာဖွေခြင်း', 'https://shawemal.example.com/finding-house'],
      ['roommate', '👥 အခန်းဖော်ရှာဖွေခြင်း', 'https://shawemal.example.com/finding-roommates'],
      ['moving', '🚚 အိမ်ပြောင်းဝန်ဆောင်မှု မှာယူခြင်း', 'https://shawemal.example.com/hire-moving'],
      ['marketplace', '🛍️ Relocation Marketplace', 'https://shawemal.example.com/marketplace'],
      ['trust', '☑ ယုံကြည်စိတ်ချရမှု စစ်ဆေးခြင်း', null]
    ];

    for (const [id, heading, url] of expected) {
      calls = [];
      expect((await send(callbackUpdate(`faq:${id}`))).status).toBe(200);
      expect(calls[0]?.method).toBe('answerCallbackQuery');

      const [message] = sentMessages();
      expect(message.text.startsWith(heading)).toBe(true);
      expect(buttons(message).filter((button) => button.url).map((button) => button.url)).toEqual(url ? [url] : []);
      expect(buttons(message).at(-1)).toEqual(expect.objectContaining({ callback_data: 'menu' }));
    }
  });

  it('never writes a website address into the message text', async () => {
    for (const id of ['rental', 'roommate', 'moving', 'marketplace', 'trust', 'contact']) {
      calls = [];
      await send(callbackUpdate(`faq:${id}`));
      expect(sentMessages()[0].text).not.toMatch(/https?:\/\//);
    }

    // With a localhost site there is no button Telegram would accept, and still no raw link.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../../src/config/env');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildFaqReply } = require('../../src/services/telegram-bot.service');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { findFaqById } = require('../../src/services/telegram-faq');
    const original = env.websiteUrl;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      env.websiteUrl = 'http://localhost:5173';
      const reply = buildFaqReply(findFaqById('rental'));
      expect(reply.text).not.toContain('localhost');
      expect(reply.keyboard.flat().filter((button: any) => button.url)).toEqual([]);
      expect(reply.keyboard.flat().at(-1)).toEqual(expect.objectContaining({ callback_data: 'menu' }));
    } finally {
      env.websiteUrl = original;
      warn.mockRestore();
    }
  });

  it('opens the menu for /start with a deep-link payload and sets up the Start screen texts', async () => {
    await send(textUpdate('/start web'));
    expect(sentMessages()[0].text).toContain('မင်္ဂလာပါ 👋');
    expect(buttons(sentMessages()[0])).toHaveLength(6);

    calls = [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await require('../../src/services/telegram-bot.service').configureTelegramBotProfile();
    expect(calls.map((call) => call.method)).toEqual(['setMyCommands', 'setMyDescription', 'setMyShortDescription']);
    expect(calls[0]?.payload.commands.map((item: any) => item.command)).toEqual(['start', 'menu']);
  });

  it('shows the support accounts under Feedback and returns to the menu', async () => {
    await send(callbackUpdate('faq:contact'));
    const [contact] = sentMessages();
    expect(buttons(contact).filter((button) => button.url)).toEqual([
      { text: '💬 @aye432007', url: 'https://t.me/aye432007' },
      { text: '💬 @sforshein', url: 'https://t.me/sforshein' }
    ]);

    calls = [];
    await send(callbackUpdate('menu'));
    expect(sentMessages()[0].text).toContain('မင်္ဂလာပါ 👋');
  });

  it('matches natural-language questions to the right FAQ', async () => {
    const cases: Array<[string, string]> = [
      ['အိမ်ငှားရှာချင်တယ်', '/finding-house'],
      ['အိမ်ဘယ်မှာရှာရမလဲ', '/finding-house'],
      ['အခန်းဖော်လိုချင်တယ်', '/finding-roommates'],
      ['Moving service ဘယ်လိုမှာရမလဲ', '/hire-moving'],
      ['Marketplace ဘယ်မှာလဲ', '/marketplace'],
      ['ပစ္စည်းရောင်းချင်တယ်', '/marketplace']
    ];

    for (const [question, path] of cases) {
      calls = [];
      await send(textUpdate(question));
      const urls = buttons(sentMessages()[0]).map((button) => button.url).filter(Boolean);
      expect(urls).toEqual([`https://shawemal.example.com${path}`]);
    }

    calls = [];
    await send(textUpdate('Agent ကို ဘယ်လိုစစ်ရမလဲ'));
    expect(sentMessages()[0].text).toContain('Verified Badge');
  });

  it('falls back to the menu for unrelated text, unknown commands, tampered buttons and non-text messages', async () => {
    for (const update of [
      textUpdate('what is the weather on mars'),
      textUpdate('/unknowncommand'),
      textUpdate('x'.repeat(5000)),
      { update_id: 9, message: { chat: { id: 555, type: 'private' }, sticker: {} } }
    ]) {
      calls = [];
      expect((await send(update)).status).toBe(200);
      const [message] = sentMessages();
      expect(message.text).toContain('မေးခွန်းကို အတိအကျ မနားလည်သေးပါဘူး။');
      expect(message.text).toContain('@aye432007 / @sforshein');
      expect(buttons(message)).toHaveLength(6);
    }

    calls = [];
    await send(callbackUpdate('faq:../../etc/passwd'));
    expect(sentMessages()[0].text).toContain('မင်္ဂလာပါ 👋');
  });

  it('ignores group chats and updates with nothing to answer', async () => {
    expect((await send(textUpdate('/start', 'group'))).status).toBe(200);
    expect((await send({ update_id: 7 })).status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  describe('local polling', () => {
    const start = () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../../src/services/telegram-polling').startTelegramPolling() as Promise<string>;
    };
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    let consoleLog: jest.SpyInstance;

    beforeEach(() => {
      consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
      expect(JSON.stringify([consoleLog.mock.calls, consoleError.mock.calls])).not.toContain(BOT_TOKEN);
      consoleLog.mockRestore();
    });

    it('answers /start from getUpdates and stops when Telegram reports a conflict', async () => {
      let polls = 0;
      global.fetch = jest.fn(async (input: any, init?: any) => {
        const method = String(input).split('/').pop() ?? '';
        calls.push({ url: String(input), method, payload: JSON.parse(init?.body ?? '{}') });
        if (method === 'getMe') return reply(200, { ok: true, result: { username: 'shawemalbot' } });
        if (method === 'getWebhookInfo') return reply(200, { ok: true, result: { url: '' } });
        if (method === 'getUpdates') {
          polls += 1;
          return polls === 1
            ? reply(200, { ok: true, result: [textUpdate('/start')] })
            : reply(409, { ok: false, description: 'Conflict: terminated by other getUpdates request' });
        }
        return reply(200, { ok: true, result: {} });
      }) as unknown as typeof fetch;

      expect(await start()).toBe('started');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(sentMessages()[0].text).toContain('မင်္ဂလာပါ 👋');
      expect(buttons(sentMessages()[0])).toHaveLength(6);
      expect(calls.filter((call) => call.method === 'getUpdates')).toHaveLength(2);
      expect(calls.find((call) => call.method === 'getUpdates' && call.payload.offset === 2)).toBeDefined();
    });

    it('does not poll while a webhook is registered and never removes it', async () => {
      global.fetch = jest.fn(async (input: any) => {
        const method = String(input).split('/').pop() ?? '';
        calls.push({ url: String(input), method, payload: {} });
        return method === 'getMe'
          ? reply(200, { ok: true, result: { username: 'shawemalbot' } })
          : reply(200, { ok: true, result: { url: 'https://api.example.com/api/v1/telegram/webhook' } });
      }) as unknown as typeof fetch;

      expect(await start()).toBe('webhook-active');
      expect(calls.map((call) => call.method)).toEqual(['getMe', 'getWebhookInfo']);
      expect(calls.some((call) => call.method === 'deleteWebhook')).toBe(false);
    });

    it('reports a rejected token without polling', async () => {
      global.fetch = jest.fn(async () => reply(401, { ok: false, description: 'Unauthorized' })) as unknown as typeof fetch;

      expect(await start()).toBe('token-rejected');
    });
  });

  it('still returns 200 and keeps the token out of logs when Telegram fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError(`fetch failed for https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
    }) as unknown as typeof fetch;

    const response = await send(textUpdate('/start'));
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(BOT_TOKEN);
    expect(consoleError).toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(BOT_TOKEN);
  });
});
