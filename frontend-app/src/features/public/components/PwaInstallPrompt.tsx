import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'shawemal.installPromptDismissed'

const copy = {
  en: {
    title: 'Keep Shawe MaL close',
    description: 'Add it to your home screen for quick access.',
    install: 'Install',
    how: 'How to add',
    ios: 'Tap Share, then choose “Add to Home Screen.”',
    dismiss: 'Dismiss install message',
  },
  my: {
    title: 'Shawe MaL ကို ပင်မမျက်နှာပြင်တွင် ထားပါ',
    description: 'လျင်မြန်စွာ ဖွင့်နိုင်ရန် ဖုန်းပင်မမျက်နှာပြင်သို့ ထည့်ပါ။',
    install: 'ထည့်သွင်းမည်',
    how: 'ထည့်သွင်းနည်း',
    ios: 'မျှဝေရန် ခလုတ်ကိုနှိပ်ပြီး “ပင်မမျက်နှာပြင်သို့ ထည့်ရန်” ကို ရွေးပါ။',
    dismiss: 'ထည့်သွင်းရန်စာကို ပိတ်မည်',
  },
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function PwaInstallPrompt() {
  const { i18n } = useTranslation()
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [isApple, setIsApple] = useState(false)
  const [showAppleHelp, setShowAppleHelp] = useState(false)
  const [isDismissed, setIsDismissed] = useState(true)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsApple(isAppleMobile())
    setIsDismissed(standalone || sessionStorage.getItem(DISMISSED_KEY) === 'true')

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallEvent(null)
      setIsDismissed(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (isDismissed || (!installEvent && !isApple)) return null
  const text = copy[i18n.resolvedLanguage?.toLowerCase().startsWith('my') ? 'my' : 'en']

  const install = async () => {
    if (!installEvent) {
      setShowAppleHelp((current) => !current)
      return
    }
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      setInstallEvent(null)
      if (choice.outcome === 'accepted') setIsDismissed(true)
    } catch {
      setInstallEvent(null)
    }
  }

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setIsDismissed(true)
  }

  return (
    <aside className="mb-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:hidden" aria-label={text.title}>
      <div className="mt-0.5 rounded-lg bg-background p-2 text-primary" aria-hidden>
        <Download className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{text.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{text.description}</p>
        {showAppleHelp ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Share className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {text.ios}
          </p>
        ) : null}
        <Button type="button" variant="link" className="mt-1 h-auto p-0 text-sm" onClick={() => void install()}>
          {isApple ? text.how : text.install}
        </Button>
      </div>
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={text.dismiss} onClick={dismiss}>
        <X className="size-4" />
      </Button>
    </aside>
  )
}
