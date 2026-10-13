import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

type HouseGalleryProps = {
  title: string
  images: Array<{ id?: string; imagePath: string }>
}

/** How many photos the page shows before the rest are behind "all photos". */
const PREVIEW_COUNT = 5

/**
 * A large first photo with smaller ones beside it. Choosing any photo opens the full-screen
 * viewer, which has previous/next buttons, arrow-key and swipe navigation and a position counter.
 */
export function HouseGallery({ title, images }: HouseGalleryProps) {
  const { t } = useTranslation()
  const [openAt, setOpenAt] = useState<number | null>(null)
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
  const preview = photos.slice(0, PREVIEW_COUNT)
  const hiddenCount = total - preview.length

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return
    const distance = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(distance) > 40) step(distance < 0 ? 1 : -1)
  }

  return (
    <>
      <div
        className={cn(
          'grid gap-2 overflow-hidden rounded-xl',
          preview.length === 1 && 'grid-cols-1',
          preview.length === 2 && 'grid-cols-2',
          preview.length >= 3 && 'grid-cols-2 sm:grid-cols-4 sm:grid-rows-2',
        )}
      >
        {preview.map((photo, index) => {
          const isLast = index === preview.length - 1
          return (
            <button
              key={photo.key}
              type="button"
              onClick={() => setOpenAt(index)}
              aria-label={t('houses.openPhoto', { index: index + 1, total })}
              className={cn(
                'group relative overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                // The first photo is the large one; on phones it spans the full width.
                index === 0 ? 'col-span-2 aspect-[16/10] sm:row-span-2 sm:aspect-auto sm:min-h-[22rem]' : 'aspect-[4/3] sm:aspect-auto sm:min-h-0',
                preview.length === 1 && 'max-h-[30rem] sm:min-h-0 sm:aspect-[16/9]',
                preview.length === 2 && 'col-span-1 aspect-[4/3] sm:row-span-1 sm:min-h-0 sm:aspect-[4/3]',
                preview.length === 3 && index > 0 && 'sm:col-span-2',
                // With four photos the last one fills its row, so no cell is left empty.
                preview.length === 4 && index === 3 && 'col-span-2 aspect-[16/9] sm:aspect-auto',
              )}
            >
              <img
                src={photo.src}
                alt={index === 0 ? title : ''}
                loading={index === 0 ? 'eager' : 'lazy'}
                onError={() => onPhotoError(photo.key)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
              />
              {isLast && hiddenCount > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">+{hiddenCount}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpenAt(0)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Images className="size-4" aria-hidden />
        {t('houses.viewAllPhotos', { count: total })}
      </button>

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
