import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Small status / label pill. Tones map to the status tokens in index.css so every
 * "Active", "Pending", "Boosted", "Premium" or "Demo" label looks the same site-wide.
 */
const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-transparent font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        info: 'bg-info-soft text-info',
        success: 'bg-success-soft text-success-ink',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-destructive',
        /** Brand yellow: Premium plan, active boost. */
        premium: 'border-cta-border bg-cta-soft text-cta-soft-foreground',
        /** Solid brand yellow, for labels over photos (Boosted). */
        cta: 'bg-cta text-cta-foreground shadow-sm',
        /** Gold: demo labels and paid placement in the agent area. */
        gold: 'border-gold/40 bg-gold-soft text-gold-ink',
        solid: 'bg-foreground text-background',
        outline: 'border-border bg-background text-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        xs: 'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
)

type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>

function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
}

export { Badge }
export type BadgeTone = NonNullable<BadgeProps['tone']>
