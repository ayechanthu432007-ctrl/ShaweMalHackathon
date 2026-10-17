import { Heart } from 'lucide-react'
import type { MouseEvent } from 'react'

import { cn } from '@/lib/utils'

type FavoriteButtonProps = {
  active: boolean
  label: string
  disabled?: boolean
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}

/**
 * The heart on house and marketplace cards. It sits over the card photo, beside (never inside)
 * the card's link, so it is its own control for keyboards and screen readers.
 */
export function FavoriteButton({ active, label, disabled, onToggle, className }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-card backdrop-blur transition-[color,background-color,transform] hover:bg-background hover:text-destructive active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:active:scale-100',
        className,
      )}
    >
      <Heart className={cn('size-4 transition-colors', active && 'fill-destructive text-destructive')} aria-hidden />
    </button>
  )
}
