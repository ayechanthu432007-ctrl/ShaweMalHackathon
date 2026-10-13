import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

type HouseGalleryProps = {
  title: string
  images: Array<{ id?: string; imagePath: string }>
}

/**
 * One large photo with previous/next arrows and a strip of thumbnails under it. Choosing the
 * large photo opens the full-screen viewer, which has previous/next buttons, arrow-key and
 * swipe navigation and a position counter.
 */
export function HouseGallery({ title, images }: HouseGalleryProps) {
  const { t } = useTranslation()
  const [openAt, setOpenAt] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const touchStartX = useRef<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const photos = images
    .map((image) => ({ key: image.id ?? image.imagePath, src: resolvePublicUploadUrl(image.imagePath) ?? image.imagePath }))
    .filter((photo) => !failed.has(photo.key))
  const total = photos.length
  const isOpen = openAt !== null && total > 0
  const current = isOpen ? Math.min(openAt, total - 1) : 0

  const step = useCallback((delta: number) => setOpenAt((index) => (index === null || total === 0 ? index : (index + delta + total) % total)), [total])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenAt(null)
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    // The page behind must not scroll while the viewer is open.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, step])

  if (total === 0) {
    return (
      <div className="flex aspect-[16/9] max-h-[26rem] w-full items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        {t('houses.noPhoto')}
      </div>
    )
  }

  const onPhotoError = (key: string) => setFailed((previous) => new Set(previous).add(key))
  const active = Math.min(activeIndex, total - 1)
  const slide = (delta: number) => setActiveIndex((active + delta + total) % total)

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return
    const distance = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(distance) > 40) step(distance < 0 ? 1 : -1)
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <button
          type="button"
          onClick={() => setOpenAt(active)}
          aria-label={t('houses.openPhoto', { index: active + 1, total })}
          className="block aspect-[4/3] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:aspect-[16/9]"
        >
          <img
            key={photos[active]?.key}
            src={photos[active]?.src}
            alt={title}
            onError={() => onPhotoError(photos[active]?.key ?? '')}
            className="h-full w-full object-cover"
          />
        </button>
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => slide(-1)}
              aria-label={t('houses.previousPhoto')}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-colors hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="size-8" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => slide(1)}
              aria-label={t('houses.nextPhoto')}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-colors hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="size-8" aria-hidden />
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium tabular-nums text-white">
              {t('houses.photoCount', { current: active + 1, total })}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {photos.map((photo, index) => (
            <li key={photo.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={t('houses.showPhoto', { index: index + 1 })}
                aria-current={index === active}
                className={cn(
                  'block rounded-md border bg-card p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === active ? 'border-primary' : 'hover:border-primary/60',
                )}
              >
                <img src={photo.src} alt="" loading="lazy" onError={() => onPhotoError(photo.key)} className="h-16 w-24 rounded-sm object-cover sm:h-[4.75rem] sm:w-28" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('houses.photoViewer', { title })}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null
          }}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm font-medium tabular-nums" aria-live="polite">
              {t('houses.photoCount', { current: current + 1, total })}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpenAt(null)}
              aria-label={t('houses.closePhotos')}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
            <img
              key={photos[current]?.key}
              src={photos[current]?.src}
              alt={t('houses.photoOf', { index: current + 1, title })}
              className="max-h-full max-w-full object-contain"
            />
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={t('houses.previousPhoto')}
                  className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
                >
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={t('houses.nextPhoto')}
                  className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
                >
                  <ChevronRight className="size-6" aria-hidden />
                </button>
              </>
            ) : null}
          </div>

          {total > 1 ? (
            <ul className="flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {photos.map((photo, index) => (
                <li key={photo.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenAt(index)}
                    aria-label={t('houses.showPhoto', { index: index + 1 })}
                    aria-current={index === current}
                    className={cn(
                      'block overflow-hidden rounded-md border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                      index === current ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100',
                    )}
                  >
                    <img src={photo.src} alt="" loading="lazy" className="h-14 w-20 object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
