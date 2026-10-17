import { useEffect, useId } from 'react'
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type MovingCancelDialogProps = {
  open: boolean
  orderNumber: string
  isPending?: boolean
  error?: string | null
  onConfirm: () => void
  onDismiss: () => void
}

/** Asks the customer to confirm before a moving booking is cancelled. */
export function MovingCancelDialog({ open, orderNumber, isPending = false, error, onConfirm, onDismiss }: MovingCancelDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onDismiss()
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
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 [&>[role=dialog]]:my-auto">
      <div aria-hidden="true" className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !isPending && onDismiss()} />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md overflow-hidden border-destructive/20 shadow-overlay"
      >
        <div className="h-1 bg-destructive" />
        <CardHeader className="space-y-4 pb-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert className="size-6" aria-hidden="true" />
          </div>
          <CardTitle>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {t('moving.cancelDialogTitle')}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div id={descriptionId} className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>{t('moving.cancelDialogBody')}</p>
            <p>
              {t('moving.orderNumber')}: <span className="font-semibold text-foreground">{orderNumber}</span>
            </p>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isPending} autoFocus onClick={onDismiss}>
              {t('moving.keepBooking')}
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
              {isPending ? t('common.loading') : t('moving.confirmCancellation')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
