import { User } from 'lucide-react'

import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

type UserAvatarProps = {
  /** Uploaded profile photo path; a default avatar is shown when there is none. */
  path?: string | null
  name?: string | null
  className?: string
}

/** A person's profile photo in a circle, or a default avatar when they have not uploaded one. */
export function UserAvatar({ path, name, className }: UserAvatarProps) {
  const src = resolvePublicUploadUrl(path)
  const initial = name?.trim().charAt(0).toUpperCase()

  return src ? (
    <img src={src} alt="" loading="lazy" className={cn('size-12 shrink-0 rounded-full border border-input object-cover', className)} />
  ) : (
    <span
      className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary', className)}
      aria-hidden
      data-default-avatar
    >
      {initial || <User className="size-1/2" />}
    </span>
  )
}
