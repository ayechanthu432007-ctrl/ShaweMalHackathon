import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_UPLOAD_REQUEST_BYTES, batchFilesForUpload, uploadFiles } from '@/lib/api/uploads-api'

const MB = 1024 * 1024
const photo = (name: string, megabytes: number) => new File([new Uint8Array(megabytes * MB)], name, { type: 'image/jpeg' })

describe('photo uploads', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps every request under the hosting limit of 4.5 MB', () => {
    const batches = batchFilesForUpload([photo('a.jpg', 2), photo('b.jpg', 2), photo('c.jpg', 2)])

    expect(batches.map((batch) => batch.map((file) => file.name))).toEqual([['a.jpg', 'b.jpg'], ['c.jpg']])
    for (const batch of batches) {
      expect(batch.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(MAX_UPLOAD_REQUEST_BYTES)
    }
  })

  it('sends small photos together in one request', () => {
    expect(batchFilesForUpload([photo('a.jpg', 1), photo('b.jpg', 1), photo('c.jpg', 1)])).toHaveLength(1)
  })

  it('uploads three large photos in several requests and returns the paths in the chosen order', async () => {
    const requests: string[][] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const names = (init?.body as FormData).getAll('files').map((entry) => (entry as File).name)
        requests.push(names)
        return new Response(JSON.stringify({ success: true, message: 'ok', data: { paths: names.map((name) => `uploads/marketplace/${name}`) } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const paths = await uploadFiles([photo('one.jpg', 3), photo('two.jpg', 3), photo('three.jpg', 3)], 'marketplace')

    expect(requests).toEqual([['one.jpg'], ['two.jpg'], ['three.jpg']])
    expect(paths).toEqual(['uploads/marketplace/one.jpg', 'uploads/marketplace/two.jpg', 'uploads/marketplace/three.jpg'])
  })
})
