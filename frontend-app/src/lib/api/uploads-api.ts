import { apiRequest } from '@/lib/api/client'

export type UploadCategory = 'houses' | 'moving' | 'docs' | 'profile' | 'marketplace'

/**
 * The hosting platform refuses any request body over 4.5 MB before it reaches the API,
 * so several photos are never sent in one request unless together they fit under this.
 */
export const MAX_UPLOAD_REQUEST_BYTES = 4 * 1024 * 1024

/** Groups files, in order, into requests that each stay under the request size limit. */
export function batchFilesForUpload(files: File[], maxBytes = MAX_UPLOAD_REQUEST_BYTES): File[][] {
  const batches: File[][] = []
  let current: File[] = []
  let currentBytes = 0

  for (const file of files) {
    if (current.length > 0 && currentBytes + file.size > maxBytes) {
      batches.push(current)
      current = []
      currentBytes = 0
    }
    current.push(file)
    currentBytes += file.size
  }
  if (current.length > 0) batches.push(current)

  return batches
}

export async function uploadFiles(
  files: File[],
  category: UploadCategory,
): Promise<string[]> {
  if (files.length === 0) {
    throw new Error('No files provided')
  }

  const paths: string[] = []
  // One batch after another, so the returned paths keep the order the files were chosen in.
  for (const batch of batchFilesForUpload(files)) {
    const formData = new FormData()
    for (const file of batch) {
      formData.append('files', file)
    }

    const data = await apiRequest<{ paths: string[] }>(
      `/uploads?category=${encodeURIComponent(category)}`,
      {
        method: 'POST',
        body: formData,
      },
    )
    paths.push(...data.paths)
  }

  return paths
}
