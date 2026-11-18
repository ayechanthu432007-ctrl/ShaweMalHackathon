import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: ReactNode
  /** The exact record being acted on, shown in bold so a mis-click is obvious. */
  recordName?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Accessible confirmation dialog that names the record. Replaces window.confirm so destructive
 * actions are styled, testable, and never ambiguous about what is about to change.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  recordName,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useRef(`confirm-title-${Math.random().toString(36).slice(2)}`).current
  const descriptionId = useRef(`confirm-description-${Math.random().toString(36).slice(2)}`).current

  useEffect(() => {
    if (!open) return
    const previousActive = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        event.preventDefault()
        onCancel()
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the safe action first, not the destructive one.
    window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [open, isPending, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 backdrop-blur-[2px] sm:items-center print:hidden">
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t('ops.confirm.dismiss')} onClick={() => !isPending && onCancel()} tabIndex={-1} />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md rounded-xl border bg-card p-5 shadow-overlay"
      >
        <div className="flex gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              tone === 'danger' ? 'bg-danger-soft text-destructive' : 'bg-primary/10 text-primary',
            )}
          >
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-2">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </div>
            ) : null}
            {recordName ? (
              <p className="break-words rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">{recordName}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? t('common.loading') : (confirmLabel ?? t('ops.confirm.defaultConfirm'))}
          </Button>
        </div>
      </div>
    </div>
  )
}
