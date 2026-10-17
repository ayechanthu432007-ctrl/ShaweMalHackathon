import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * One button for the whole site. Variants:
 * - cta: brand yellow, for the forward / primary action of a page or card (Book, Next, Upgrade).
 * - default: the soft blue filled button for other confirming actions.
 * - outline / secondary / ghost / link / destructive for everything else.
 * Heights come from the control tokens (sm 32px, default 36px, lg 44px) so buttons line up with inputs.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-button text-button-foreground shadow-card hover:bg-button-hover',
        cta: 'border border-cta-border bg-cta font-semibold text-cta-foreground shadow-card hover:bg-cta-hover',
        destructive: 'bg-destructive text-white shadow-card hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-button-soft text-button-soft-foreground hover:bg-button-soft-hover',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        default: 'h-control-md px-4 py-2',
        sm: 'h-control-sm rounded-md px-3 text-xs',
        lg: 'h-control-lg rounded-lg px-6 text-base',
        icon: 'size-control-md',
        'icon-lg': 'size-control-lg rounded-full [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
