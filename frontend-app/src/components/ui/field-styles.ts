/**
 * Native <select> and <textarea> share the Input look: control height, border, focus ring,
 * invalid and disabled states. Import these instead of re-declaring the classes per page.
 */
const fieldBase =
  'w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60'

export const selectClassName = `flex h-control-md py-1 ${fieldBase}`

export const textareaClassName = `flex min-h-24 py-2 ${fieldBase}`
