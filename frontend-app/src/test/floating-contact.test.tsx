import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isMobileDevice, telegramBotAppLink, telegramBotLink, toInternationalPhone, viberChatLink } from '@/lib/contact-links'
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
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('builds the app link for the same bot and recognises phones', () => {
    expect(telegramBotAppLink('shawemalbot')).toBe('tg://resolve?domain=shawemalbot&start=web')
    expect(telegramBotAppLink('')).toBeNull()
    expect(isMobileDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36')).toBe(true)
    expect(isMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1')).toBe(true)
    expect(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36')).toBe(false)
  })

  it('keeps the normal new-tab link on desktop', async () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0' })
    await renderButtons({ VITE_TELEGRAM_BOT_USERNAME: 'shawemalbot' })
    const telegram = screen.getByRole('link', { name: /telegram/i })
    // Not prevented: the browser follows href in a new tab as before.
    expect(fireEvent.click(telegram)).toBe(true)
  })

  it('opens the Telegram app in the same tab on phones, then falls back to t.me', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' })
    const visited: string[] = []
    vi.stubGlobal('location', { set href(value: string) { visited.push(value) }, get href() { return visited.at(-1) ?? '' } })
    await renderButtons({ VITE_TELEGRAM_BOT_USERNAME: 'shawemalbot' })

    const telegram = screen.getByRole('link', { name: /telegram/i })
    expect(fireEvent.click(telegram)).toBe(false)
    expect(visited).toEqual(['tg://resolve?domain=shawemalbot&start=web'])
    vi.advanceTimersByTime(1600)
    // The app did not take over (page still visible): same bot, web link, same tab.
    expect(visited).toEqual(['tg://resolve?domain=shawemalbot&start=web', 'https://t.me/shawemalbot?start=web'])
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
