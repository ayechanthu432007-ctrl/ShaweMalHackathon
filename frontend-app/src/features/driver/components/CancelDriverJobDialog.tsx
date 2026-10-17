import { useEffect, useId, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

type CancelDriverJobDialogProps = {
  open: boolean
  orderLabel: string
  isPending?: boolean
  onConfirm: (reason: string) => void
  onDismiss: () => void
}

export function CancelDriverJobDialog({
  open,
  orderLabel,
  isPending = false,
  onConfirm,
  onDismiss,
}: CancelDriverJobDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setReason('')
      setError(null)
      return
    }

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

  if (!open) {
    return null
  }

  const submit = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError(t('driver.cancelReasonRequired'))
      return
    }

    setError(null)
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 [&>[role=dialog]]:my-auto">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
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
        className="relative z-10 w-full max-w-md overflow-hidden border-destructive/20 shadow-overlay"
      >
        <div className="h-1 bg-destructive" />
        <CardHeader className="space-y-4 pb-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert className="size-6" aria-hidden="true" />
          </div>
          <CardTitle>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {t('driver.cancelDialogTitle')}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p id={descriptionId} className="text-sm leading-relaxed text-muted-foreground">
            {t('driver.cancelDialogBody', { order: orderLabel })}
          </p>
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t('driver.cancelReasonLabel')}</Label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                if (error && event.target.value.trim()) {
                  setError(null)
                }
              }}
              rows={4}
              className="flex min-h-[6rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('driver.cancelReasonPlaceholder')}
              disabled={isPending}
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isPending} autoFocus onClick={onDismiss}>
              {t('driver.keepJob')}
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={submit}>
              {isPending ? t('common.loading') : t('driver.cancelJob')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
