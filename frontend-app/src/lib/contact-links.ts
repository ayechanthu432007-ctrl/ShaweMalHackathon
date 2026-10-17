/** Local Myanmar numbers (09…) become international (+959…), which Viber deep links require. */
export function toInternationalPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('09')) return `+95${digits.slice(1)}`
  return digits
}

/** Shown in .env.example; treated the same as "not configured". */
const TELEGRAM_USERNAME_PLACEHOLDER = 'YOUR_PUBLIC_BOT_USERNAME'

/** Opened by the Telegram button until the bot's public username is configured. */
export const TELEGRAM_FALLBACK_LINK = 'https://t.me/'

/**
 * The `start` parameter makes Telegram show its own START button even to people who have
 * used the bot before; pressing it sends /start, which opens the FAQ menu.
 */
export function telegramBotLink(username: string): string | null {
  if (username === TELEGRAM_USERNAME_PLACEHOLDER) return null
  return /^[A-Za-z0-9_]{4,32}$/.test(username) ? `https://t.me/${username}?start=web` : null
}

/**
 * The same bot as `telegramBotLink`, as Telegram's app scheme. Phones open the Telegram app with
 * it directly; the https link stays as the fallback when the app is not installed.
 */
export function telegramBotAppLink(username: string): string | null {
  if (!telegramBotLink(username)) return null
  return `tg://resolve?domain=${username}&start=web`
}

/** Phones and tablets, where links that open a new tab often fail to hand off to the Telegram app. */
export function isMobileDevice(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|FBAN|FBAV|Viber|Line\//i.test(userAgent)
}

/** Link to a person's Telegram profile from a stored username or t.me address. */
export function telegramProfileLink(value: string | null | undefined): string | null {
  const username = (value ?? '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
  return /^[A-Za-z0-9_]{4,32}$/.test(username) ? `https://t.me/${username}` : null
}

export function viberChatLink(phone: string): string | null {
  const international = toInternationalPhone(phone)
  return /^\+\d{8,15}$/.test(international) ? `viber://chat?number=${encodeURIComponent(international)}` : null
}
