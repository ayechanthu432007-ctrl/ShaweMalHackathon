import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

export function SellerAvatar({ name, path, size = 'md' }: { name: string; path: string | null; size?: 'md' | 'lg' }) {
  const src = resolvePublicUploadUrl(path)
  const sizeClass = size === 'lg' ? 'size-20 text-2xl' : 'size-11 text-base'

  if (src) {
    return <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', sizeClass)} />
  }

  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary', sizeClass)}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
