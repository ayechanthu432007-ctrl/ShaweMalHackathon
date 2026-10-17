import { ImageOff } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

type CoverImageProps = {
  src: string | null | undefined
  alt: string
  /** Shown when there is no photo or it fails to load; leave out for an icon-only placeholder. */
  fallbackLabel?: string
  className?: string
}

/**
 * Card photo that fills its (aspect-ratio) box. A missing or broken photo shows a quiet
 * placeholder instead of the browser's broken-image icon and overflowing alt text.
 */
export function CoverImage({ src, alt, fallbackLabel, className }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted text-center text-xs text-muted-foreground sm:text-sm">
        <ImageOff className="size-6 opacity-60" aria-hidden />
        {fallbackLabel}
      </div>
    )
  }

  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} className={cn('h-full w-full object-cover', className)} />
}
