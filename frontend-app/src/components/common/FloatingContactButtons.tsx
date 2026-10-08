import { useTranslation } from 'react-i18next'

import { TELEGRAM_FALLBACK_LINK, telegramBotLink, viberChatLink } from '@/lib/contact-links'

/**
 * Public contact details only. The Telegram bot token is a server secret and must never
 * be added to the frontend environment.
 */
const TELEGRAM_BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '')
const VIBER_PHONE = (import.meta.env.VITE_VIBER_PHONE ?? '+959266216602').trim()

const buttonClassName =
  'flex size-12 items-center justify-center rounded-full text-white shadow-lg shadow-black/20 ring-1 ring-black/5 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 sm:size-14'

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 sm:size-7" fill="currentColor" aria-hidden>
      <path d="M21.4 4.3 2.9 11.5c-1 .4-1 1.2-.2 1.4l4.7 1.5 1.8 5.6c.2.6.4.8.8.8s.6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.3-1.5ZM8.2 14.1l9.5-6c.4-.3.9-.1.5.2l-7.8 7.1-.3 3.3-1.9-4.6Z" />
    </svg>
  )
}

function ViberIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 sm:size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3c-4.6 0-8 2.9-8 7.4 0 2.4 1 4.4 2.7 5.7V20l3.1-2.2c.7.1 1.4.2 2.2.2 4.6 0 8-2.9 8-7.6C20 5.9 16.6 3 12 3Z" />
      <path d="M9.3 7.6c-.5.4-.7.9-.6 1.5.4 2.3 2.1 4.1 4.4 4.6.6.1 1.2-.1 1.6-.5l.3-.4-1.5-1.2-.6.5c-.9-.4-1.6-1.1-2-2l.5-.6-1.1-1.6-1-.3Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Fixed bottom-right shortcuts to the Shawe Mal Telegram bot and Viber contact. */
export function FloatingContactButtons() {
  const { t } = useTranslation()
  // The Telegram button is always shown. It needs only the bot's public username, never the token.
  const telegramHref = telegramBotLink(TELEGRAM_BOT_USERNAME) ?? TELEGRAM_FALLBACK_LINK
  const viberHref = viberChatLink(VIBER_PHONE)

  return (
    <div
      className="fixed right-4 z-40 flex flex-col gap-3 sm:right-6"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <a
        href={telegramHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('contact.telegram')}
        title={t('contact.telegram')}
        className={`${buttonClassName} bg-[#229ED9]`}
      >
        <TelegramIcon />
      </a>
      {viberHref ? (
        <a
          href={viberHref}
          aria-label={t('contact.viber')}
          title={t('contact.viber')}
          className={`${buttonClassName} bg-[#7360F2]`}
        >
          <ViberIcon />
        </a>
      ) : null}
    </div>
  )
}
