import { useEffect, useId } from 'react'
import { CalendarCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ACTION_BUTTON } from './action-button'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BookHouseDialogProps = {
  open: boolean
  houseTitle: string
  isPending?: boolean
  onConfirm: () => void
  onDismiss: () => void
}

export function BookHouseDialog({
  open,
  houseTitle,
  isPending = false,
  onConfirm,
  onDismiss,
}: BookHouseDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onDismiss()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, isPending, onDismiss])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!isPending) {
            onDismiss()
          }
        }}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md overflow-hidden border-primary/20 shadow-2xl"
      >
        <div className="h-1 bg-primary" />
        <CardHeader className="space-y-4 pb-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarCheck className="size-6" aria-hidden="true" />
          </div>
          <CardTitle>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {t('houses.bookDialogTitle')}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p id={descriptionId} className="text-sm leading-relaxed text-muted-foreground">
            {t('houses.bookDialogBody', { house: houseTitle })}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isPending} autoFocus onClick={onDismiss}>
              {t('houses.bookDialogStay')}
            </Button>
            <Button type="button" className={ACTION_BUTTON} disabled={isPending} onClick={onConfirm}>
              {isPending ? t('common.loading') : t('houses.bookNow')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
