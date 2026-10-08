import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { telegramBotLink, toInternationalPhone, viberChatLink } from '@/lib/contact-links'
import { i18n } from '@/lib/i18n'

async function renderButtons(env: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const { FloatingContactButtons } = await import('@/components/common/FloatingContactButtons')
  return render(
    <I18nextProvider i18n={i18n}>
      <FloatingContactButtons />
    </I18nextProvider>,
  )
}

describe('floating contact buttons', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds Telegram and Viber links from public values only', () => {
    expect(telegramBotLink('ShaweMalBot')).toBe('https://t.me/ShaweMalBot?start=web')
    expect(telegramBotLink('')).toBeNull()
    expect(telegramBotLink('123456:ABC-token-looking-value')).toBeNull()

    expect(toInternationalPhone('09266216602')).toBe('+959266216602')
    expect(toInternationalPhone('+95 9 266 216 602')).toBe('+959266216602')
    expect(viberChatLink('09266216602')).toBe('viber://chat?number=%2B959266216602')
    expect(viberChatLink('not a phone')).toBeNull()
  })

  it('links to the configured bot and the Viber contact', async () => {
    await renderButtons({ VITE_TELEGRAM_BOT_USERNAME: '@ShaweMalBot', VITE_VIBER_PHONE: '09266216602' })

    const telegram = screen.getByRole('link', { name: /telegram/i })
    expect(telegram).toHaveAttribute('href', 'https://t.me/ShaweMalBot?start=web')
    expect(telegram).toHaveAttribute('target', '_blank')
    expect(telegram).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByRole('link', { name: /viber/i })).toHaveAttribute('href', 'viber://chat?number=%2B959266216602')
  })

  it.each(['', 'YOUR_PUBLIC_BOT_USERNAME'])('still shows the Telegram button when the username is %j', async (username) => {
    await renderButtons({ VITE_TELEGRAM_BOT_USERNAME: username, VITE_VIBER_PHONE: '+959266216602' })

    expect(screen.getByRole('link', { name: /telegram/i })).toHaveAttribute('href', 'https://t.me/')
    expect(screen.getByRole('link', { name: /viber/i })).toBeInTheDocument()
  })
})
