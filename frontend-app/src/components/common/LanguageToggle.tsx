import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALE_STORAGE_KEY, setAppLocale, type AppLocale } from '@/lib/i18n'

export function LanguageToggle() {
  const { t } = useTranslation()

  const changeLanguage = (locale: AppLocale) => {
    void setAppLocale(locale)
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('common.language')}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => changeLanguage('en')}>{t('common.english')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('my')}>{t('common.myanmar')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
