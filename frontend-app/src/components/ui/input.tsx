import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  const isDateLike = type === 'date' || type === 'time' || type === 'datetime-local' || type === 'month' || type === 'week'

  return (
    <input
      type={type}
      className={cn(
        'h-control-md w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
        isDateLike
          ? 'block [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer'
          : 'flex',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
