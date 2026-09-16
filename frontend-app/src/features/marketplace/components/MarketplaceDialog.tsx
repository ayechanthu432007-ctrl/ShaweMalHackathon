import { useEffect, useId, type ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type MarketplaceDialogProps = {
  open: boolean
  title: string
  description?: string
  icon?: ReactNode
  tone?: 'primary' | 'destructive'
  busy?: boolean
  onDismiss: () => void
  children: ReactNode
}

/** Modal chrome matching the existing booking/rating dialogs. */
export function MarketplaceDialog({
  open,
  title,
  description,
  icon,
  tone = 'primary',
  busy = false,
  onDismiss,
  children,
}: MarketplaceDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, busy, onDismiss])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onDismiss()
        }}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl"
      >
        <div className={cn('h-1', tone === 'destructive' ? 'bg-destructive' : 'bg-primary')} />
        <CardHeader className="space-y-3 pb-3">
          {icon ? (
            <div
              className={cn(
                'flex size-11 items-center justify-center rounded-full',
                tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
              )}
            >
              {icon}
            </div>
          ) : null}
          <CardTitle>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
          </CardTitle>
          {description ? (
            <p id={descriptionId} className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}

export const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background'

export const textareaClassName =
  'flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
