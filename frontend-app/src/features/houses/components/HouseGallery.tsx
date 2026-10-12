import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

type HouseGalleryProps = {
  title: string
  images: Array<{ id?: string; imagePath: string }>
}

/** One large photo with the rest as thumbnails; choosing a thumbnail shows it large. */
export function HouseGallery({ title, images }: HouseGalleryProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const photos = images.map((image) => ({ key: image.id ?? image.imagePath, src: resolvePublicUploadUrl(image.imagePath) ?? image.imagePath }))
  const current = photos[Math.min(selected, photos.length - 1)]

  if (!current) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        {t('houses.noPhoto')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border bg-muted">
        <img src={current.src} alt={title} className="aspect-[16/10] max-h-[30rem] w-full object-cover sm:aspect-[16/9]" />
        {photos.length > 1 ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium shadow-sm">
            {t('houses.photoCount', { current: selected + 1, total: photos.length })}
          </span>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <li key={photo.key} className="shrink-0">
              <button
                type="button"
                className={cn(
                  'block overflow-hidden rounded-lg border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === selected ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
                )}
                aria-label={t('houses.showPhoto', { index: index + 1 })}
                aria-current={index === selected}
                onClick={() => setSelected(index)}
              >
                <img src={photo.src} alt="" loading="lazy" className="h-16 w-24 object-cover sm:h-20 sm:w-28" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
