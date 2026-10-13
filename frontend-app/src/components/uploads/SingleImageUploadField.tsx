import { ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'
import { uploadFiles, type UploadCategory } from '@/lib/api/uploads-api'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
// The hosting platform refuses request bodies over 4.5 MB, so one file must stay below that.
const MAX_BYTES = 4 * 1024 * 1024

export type SingleImageUploadFieldProps = {
  path: string
  onChange: (path: string) => void
  category: UploadCategory
  disabled?: boolean
  error?: string
  /** When true, keep a local object-URL preview (needed for protected `docs`). */
  localPreview?: boolean
}

export function SingleImageUploadField({
  path,
  onChange,
  category,
  disabled = false,
  error,
  localPreview = category === 'docs',
}: SingleImageUploadFieldProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const displayError = localError ?? error
  const publicSrc = !localPreview ? resolvePublicUploadUrl(path) : null
  const src = previewUrl ?? publicSrc

  const onPickFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled || uploading) return

    setLocalError(null)
    const file = fileList[0]
    if (!file) return

    if (!ACCEPTED_TYPES.has(file.type)) {
      setLocalError(t('uploads.invalidType'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setLocalError(t('uploads.fileTooLarge'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const nextPreview = URL.createObjectURL(file)
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(nextPreview)

    setUploading(true)
    try {
      const uploaded = await uploadFiles([file], category)
      onChange(uploaded[0] ?? '')
    } catch (err) {
      setLocalError(err instanceof ApiRequestError ? err.message : t('uploads.uploadFailed'))
      if (nextPreview.startsWith('blob:')) {
        URL.revokeObjectURL(nextPreview)
      }
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = () => {
    if (disabled || uploading) return
    setLocalError(null)
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    onChange('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => void onPickFile(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {uploading ? t('uploads.uploading') : path ? t('uploads.replacePhoto') : t('uploads.addPhoto')}
        </Button>
        <Label htmlFor={inputId} className="sr-only">
          {t('uploads.addPhoto')}
        </Label>
        {path ? (
          <span className="text-xs text-muted-foreground">{t('uploads.uploaded')}</span>
        ) : null}
      </div>

      {src ? (
        <div className="relative aspect-[4/3] max-w-xs overflow-hidden rounded-md border border-input bg-muted">
          <img src={src} alt="" className="h-full w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={cn(
              'absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90',
              (disabled || uploading) && 'pointer-events-none opacity-50',
            )}
            aria-label={t('uploads.remove')}
            disabled={disabled || uploading}
            onClick={onRemove}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : path && localPreview ? (
        <p className="text-xs text-muted-foreground">{t('uploads.uploadedNoPreview')}</p>
      ) : null}

      {displayError ? (
        <p className="text-xs text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  )
}
