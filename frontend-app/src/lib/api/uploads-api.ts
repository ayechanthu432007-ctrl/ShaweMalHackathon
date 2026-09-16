import { apiRequest } from '@/lib/api/client'

export type UploadCategory = 'houses' | 'moving' | 'docs' | 'profile' | 'marketplace'

export async function uploadFiles(
  files: File[],
  category: UploadCategory,
): Promise<string[]> {
  if (files.length === 0) {
    throw new Error('No files provided')
  }

  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  const data = await apiRequest<{ paths: string[] }>(
    `/uploads?category=${encodeURIComponent(category)}`,
    {
      method: 'POST',
      body: formData,
    },
  )

  return data.paths
}
