import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/** Inline notice box (demo notes, warnings, errors, confirmations). An icon child sits at the start. */
const alertVariants = cva(
  'flex items-start gap-2 rounded-xl border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-muted/50 text-foreground',
        info: 'border-info/25 bg-info-soft text-info',
        success: 'border-success/25 bg-success-soft text-success-ink',
        warning: 'border-warning/30 bg-warning-soft text-warning',
        destructive: 'border-destructive/30 bg-danger-soft text-destructive',
        /** Demo-only features: gold and dashed so they are never mistaken for real payments. */
        demo: 'border-dashed border-gold/60 bg-gold-soft font-medium text-gold-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

function Alert({ className, tone, role = 'note', ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role={role} className={cn(alertVariants({ tone }), className)} {...props} />
}

export { Alert }
