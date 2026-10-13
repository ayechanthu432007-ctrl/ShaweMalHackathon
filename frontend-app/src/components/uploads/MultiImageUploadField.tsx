import { ImagePlus, Loader2, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
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

export type MultiImageUploadFieldProps = {
  paths: string[]
  onChange: (paths: string[]) => void
  category: UploadCategory
  maxFiles?: number
  disabled?: boolean
  error?: string
}

export function MultiImageUploadField({
  paths,
  onChange,
  category,
  maxFiles = 5,
  disabled = false,
  error,
}: MultiImageUploadFieldProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const remaining = Math.max(0, maxFiles - paths.length)
  const displayError = localError ?? error

  const onPickFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled || uploading) return

    setLocalError(null)

    const selected = Array.from(fileList)
    if (selected.length > remaining) {
      setLocalError(t('uploads.maxFiles', { max: maxFiles }))
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    for (const file of selected) {
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
    }

    setUploading(true)
    try {
      const uploaded = await uploadFiles(selected, category)
      onChange([...paths, ...uploaded].slice(0, maxFiles))
    } catch (err) {
      setLocalError(
        err instanceof ApiRequestError ? err.message : t('uploads.uploadFailed'),
      )
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = (index: number) => {
    if (disabled || uploading) return
    setLocalError(null)
    onChange(paths.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={disabled || uploading || remaining === 0}
          onChange={(event) => void onPickFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading || remaining === 0}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {uploading ? t('uploads.uploading') : t('uploads.addPhotos')}
        </Button>
        <Label htmlFor={inputId} className="sr-only">
          {t('uploads.addPhotos')}
        </Label>
        <span className="text-xs text-muted-foreground">
          {paths.length}/{maxFiles}
        </span>
      </div>

      {paths.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {paths.map((path, index) => {
            const src = resolvePublicUploadUrl(path) ?? path
            return (
              <li
                key={`${path}-${index}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-md border border-input bg-muted"
              >
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                />
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
                  onClick={() => onRemove(index)}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {displayError ? (
        <p className="text-xs text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  )
}
