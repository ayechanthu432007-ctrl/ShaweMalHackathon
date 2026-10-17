import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'

export const LOCALE_STORAGE_KEY = 'shwemal.locale'
export type AppLocale = 'en' | 'my'

const defaultLocale = (import.meta.env.VITE_DEFAULT_LOCALE as AppLocale | undefined) ?? 'en'

const storedLocale =
  typeof window !== 'undefined'
    ? (localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale | null)
    : null

/** The locale the app starts in (saved choice, else the build default). */
export const initialLocale: AppLocale = storedLocale ?? defaultLocale

// English is bundled (it is also the fallback); Myanmar (~185 KB) is fetched only when it is used.
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

async function ensureLocaleLoaded(locale: AppLocale) {
  if (locale === 'en' || i18n.hasResourceBundle(locale, 'translation')) return
  const { default: resources } = await import('./locales/my.json')
  i18n.addResourceBundle(locale, 'translation', resources)
}

/** Loads the locale's strings if needed, then switches the app to it. */
export async function setAppLocale(locale: AppLocale) {
  await ensureLocaleLoaded(locale)
  await i18n.changeLanguage(locale)
}

export { i18n }
