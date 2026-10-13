import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'
import { MAX_UPLOAD_REQUEST_BYTES, uploadFiles } from '@/lib/api/uploads-api'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

import { compressImage } from '../lib/compress-image'

export const MARKETPLACE_MAX_PHOTOS = 10
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
/** Hard stop before compression; anything bigger is almost certainly not a phone photo. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024
/** One photo must fit in a single upload request after compression. */
const MAX_UPLOAD_BYTES = MAX_UPLOAD_REQUEST_BYTES

type MarketplacePhotoUploaderProps = {
  photos: string[]
  coverIndex: number
  onChange: (next: { photos: string[]; coverIndex: number }) => void
  error?: string
}

function move<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

export function MarketplacePhotoUploader({ photos, coverIndex, onChange, error }: MarketplacePhotoUploaderProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const remaining = MARKETPLACE_MAX_PHOTOS - photos.length

  const onPickFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || uploading) return
    setLocalError(null)

    const selected = Array.from(fileList)
    const reset = () => {
      if (inputRef.current) inputRef.current.value = ''
    }

    if (selected.length > remaining) {
      setLocalError(t('uploads.maxFiles', { max: MARKETPLACE_MAX_PHOTOS }))
      reset()
      return
    }

    if (selected.some((file) => !ACCEPTED_TYPES.has(file.type))) {
      setLocalError(t('uploads.invalidType'))
      reset()
      return
    }

    if (selected.some((file) => file.size > MAX_SOURCE_BYTES)) {
      setLocalError(t('marketplace.photos.tooLarge'))
      reset()
      return
    }

    setUploading(true)
    try {
      const compressed = await Promise.all(selected.map(compressImage))
      if (compressed.some((file) => file.size > MAX_UPLOAD_BYTES)) {
        setLocalError(t('uploads.fileTooLarge'))
        return
      }

      const uploaded = await uploadFiles(compressed, 'marketplace')
      onChange({ photos: [...photos, ...uploaded].slice(0, MARKETPLACE_MAX_PHOTOS), coverIndex })
    } catch (err) {
      setLocalError(err instanceof ApiRequestError ? err.message : t('uploads.uploadFailed'))
    } finally {
      setUploading(false)
      reset()
    }
  }

  const onRemove = (index: number) => {
    const next = photos.filter((_, i) => i !== index)
    const nextCover = index === coverIndex ? 0 : index < coverIndex ? coverIndex - 1 : coverIndex
    onChange({ photos: next, coverIndex: Math.min(nextCover, Math.max(0, next.length - 1)) })
  }

  const onMove = (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return
    const coverPath = photos[coverIndex]
    const next = move(photos, from, to)
    onChange({ photos: next, coverIndex: Math.max(0, next.indexOf(coverPath as string)) })
  }

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault()
    if (dragIndex !== null) onMove(dragIndex, index)
    setDragIndex(null)
  }

  const displayError = localError ?? error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={uploading || remaining === 0}
          onChange={(event) => void onPickFiles(event.target.files)}
        />
        <Button type="button" variant="outline" disabled={uploading || remaining === 0} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          {uploading ? t('uploads.uploading') : t('uploads.addPhotos')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('marketplace.photos.count', { count: photos.length, max: MARKETPLACE_MAX_PHOTOS })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('marketplace.photos.hint')}</p>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((path, index) => {
            const isCover = index === coverIndex
            return (
              <li
                key={path}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, index)}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'group relative aspect-square cursor-grab overflow-hidden rounded-lg border-2 bg-muted',
                  isCover ? 'border-primary' : 'border-transparent',
                  dragIndex === index && 'opacity-50',
                )}
              >
                <img src={resolvePublicUploadUrl(path) ?? path} alt={t('marketplace.photos.photoAlt', { index: index + 1 })} className="h-full w-full object-cover" />
                {isCover ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    {t('marketplace.photos.cover')}
                  </span>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90"
                  aria-label={t('uploads.remove')}
                  onClick={() => onRemove(index)}
                >
                  <X className="size-3.5" />
                </Button>
                <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7 rounded-full bg-background/90"
                    aria-label={t('marketplace.photos.moveLeft')}
                    disabled={index === 0}
                    onClick={() => onMove(index, index - 1)}
                  >
                    <ArrowLeft className="size-3.5" />
                  </Button>
                  {!isCover ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 rounded-full bg-background/90 px-2 text-[11px]"
                      onClick={() => onChange({ photos, coverIndex: index })}
                    >
                      <Star className="size-3" aria-hidden />
                      {t('marketplace.photos.setCover')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7 rounded-full bg-background/90"
                    aria-label={t('marketplace.photos.moveRight')}
                    disabled={index === photos.length - 1}
                    onClick={() => onMove(index, index + 1)}
                  >
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/50"
        >
          <ImagePlus className="size-8" aria-hidden />
          {t('marketplace.photos.empty')}
        </button>
      )}

      {displayError ? (
        <p className="text-sm text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  )
}
