const MAX_EDGE = 2560
const COMPRESS_OVER_BYTES = 1.5 * 1024 * 1024
/** A single photo must fit in one upload request, which the hosting platform caps at 4.5 MB. */
export const MAX_COMPRESSED_BYTES = 3.5 * 1024 * 1024
/** Tried in order until the photo is small enough: first the normal quality, then smaller and lighter. */
const ATTEMPTS = [
  { edge: MAX_EDGE, quality: 0.85 },
  { edge: 2048, quality: 0.8 },
  { edge: 1600, quality: 0.75 },
  { edge: 1280, quality: 0.7 },
] as const

/**
 * Shrinks large photos in the browser before upload so phones on slow connections
 * don't send 10 MB camera images. The server still creates its own optimized copies.
 * Falls back to the original file whenever the browser can't decode or re-encode it.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const longestEdge = Math.max(bitmap.width, bitmap.height)

    if (longestEdge <= MAX_EDGE && file.size <= COMPRESS_OVER_BYTES) {
      bitmap.close()
      return file
    }

    let best: Blob | null = null
    for (const attempt of ATTEMPTS) {
      const scale = Math.min(1, attempt.edge / longestEdge)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      if (!context) break

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', attempt.quality))
      if (!blob) break

      best = blob
      if (blob.size <= MAX_COMPRESSED_BYTES) break
    }
    bitmap.close()

    if (!best || best.size >= file.size) {
      return file
    }

    return new File([best], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
