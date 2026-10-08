import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FindingRoommatesPage } from '@/features/roommates/pages/FindingRoommatesPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function encodeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: status < 400, message: 'ok', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const basePost = {
  budgetCostSharing: 'Split utilities 50/50',
  gender: 'ANY',
  occupation: { id: 'occ1', name: 'Engineer' },
  preferences: { isNoSmoking: true },
  hobbies: { hobbyReading: true },
  house: { id: 'h1', title: 'Campus Condo', city: { id: 'c1', name: 'Yangon' }, state: { id: 's1', name: 'Yangon' } },
}

type Call = { url: string; method: string; body: unknown }

function setup() {
  const posts = [
    // Created before photos existed: no `photos` field at all.
    { ...basePost, id: 'rm-old', title: 'Legacy post', user: { id: 'u2', name: 'Bo Bo', phone: '0911' } },
    {
      ...basePost,
      id: 'rm-mine',
      title: 'My own post',
      photos: ['uploads/profile/mine-1.jpg', 'uploads/profile/mine-2.jpg'],
      user: { id: 'u1', name: 'Alice User', phone: '0922' },
    },
  ]
  const calls: Call[] = []
  let uploadCount = 0

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
      calls.push({ url, method, body })

      if (url.includes('/auth/verify')) {
        return json({ user: { id: 'u1', name: 'Alice User', email: 'alice@example.com', roles: ['user'] } })
      }
      if (url.includes('/master-data/occupations')) return json({ items: [{ id: 'occ1', name: 'Engineer' }] })
      if (url.includes('/master-data/cities')) return json({ items: [{ id: 'c1', name: 'Yangon', stateId: 's1' }] })
      if (url.includes('/master-data/states')) return json({ items: [{ id: 's1', name: 'Yangon Region' }] })
      if (url.includes('/houses')) return json({ items: [{ id: 'h1', title: 'Campus Condo' }], total: 1 })
      if (url.includes('/uploads')) {
        uploadCount += 1
        return json({ paths: [`uploads/profile/new-${uploadCount}.jpg`] }, 201)
      }
      if (url.includes('/roommates')) {
        if (method === 'GET') return json({ items: posts })
        if (method === 'DELETE') {
          posts.splice(
            posts.findIndex((post) => url.endsWith(`/${post.id}`)),
            1,
          )
          return json({ id: 'rm-mine' })
        }
        return json({ item: posts[1] }, method === 'POST' ? 201 : 200)
      }
      return json(null, 404)
    }),
  )

  return { calls, user: userEvent.setup() }
}

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const roommateCalls = (calls: Call[], method: string) =>
  calls.filter((call) => call.method === method && call.url.includes('/roommates'))

describe('roommate post photos and owner actions', () => {
  beforeEach(() => {
    tokenStorage.clear()
    tokenStorage.setTokens(encodeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'u1' }), 'refresh-token', true)
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => undefined }))
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })

  it('shows photos when present, tolerates posts without them, and limits actions to the owner', async () => {
    setup()
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    expect(await screen.findByText('Legacy post')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /photo 1 of alice user/i })).toHaveAttribute(
      'src',
      expect.stringContaining('uploads/profile/mine-1.jpg'),
    )
    expect(screen.getByRole('img', { name: /photo 2 of alice user/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /of bo bo/i })).toBeNull()

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(1))
    expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1)
  })

  it('blocks a new post without a photo, then submits with one or two', async () => {
    const { calls, user } = setup()
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    await user.click(await screen.findByRole('button', { name: /post roommate request/i }))
    await screen.findByRole('option', { name: 'Campus Condo' })
    const form = screen.getByRole('button', { name: /publish post/i }).closest('form') as HTMLFormElement
    const selects = within(form).getAllByRole('combobox')
    await user.selectOptions(selects[0] as HTMLElement, 'h1')
    await user.selectOptions(selects[2] as HTMLElement, 'occ1')
    const textboxes = within(form).getAllByRole('textbox')
    await user.type(textboxes[0] as HTMLElement, 'Need a roommate')
    await user.type(textboxes[1] as HTMLElement, 'Half each')

    await user.click(screen.getByRole('button', { name: /publish post/i }))
    expect(await screen.findByText(/photo 1 is required/i)).toBeInTheDocument()
    expect(roommateCalls(calls, 'POST')).toHaveLength(0)

    // Exactly two upload slots: a third photo has nowhere to go.
    const fileInputs = form.querySelectorAll<HTMLInputElement>('input[type="file"]')
    expect(fileInputs).toHaveLength(2)

    await user.upload(fileInputs[0] as HTMLInputElement, photo('me.jpg'))
    await waitFor(() => expect(screen.queryByText(/photo 1 is required/i)).toBeNull())
    expect(form.querySelectorAll('img')).toHaveLength(1)

    await user.upload(fileInputs[1] as HTMLInputElement, photo('me-2.jpg'))
    await waitFor(() => expect(form.querySelectorAll('img')).toHaveLength(2))

    // Remove the optional second photo again and submit with just one.
    await user.click(within(form).getAllByRole('button', { name: /remove photo/i })[1] as HTMLElement)
    await user.click(screen.getByRole('button', { name: /publish post/i }))

    await waitFor(() => expect(roommateCalls(calls, 'POST')).toHaveLength(1))
    expect(roommateCalls(calls, 'POST')[0]?.body).toMatchObject({
      houseId: 'h1',
      title: 'Need a roommate',
      photos: ['uploads/profile/new-1.jpg'],
    })
    expect(await screen.findByText(/roommate post created/i)).toBeInTheDocument()
  })

  it('rejects files that are not images', async () => {
    const { calls, user } = setup()
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    await user.click(await screen.findByRole('button', { name: /post roommate request/i }))
    const form = screen.getByRole('button', { name: /publish post/i }).closest('form') as HTMLFormElement
    const input = form.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, new File(['x'], 'cv.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText(/only jpeg, png, and webp/i)).toBeInTheDocument()
    expect(calls.some((call) => call.url.includes('/uploads'))).toBe(false)
  })

  it('edits the owner post with its existing values and photos', async () => {
    const { calls, user } = setup()
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    await user.click(await screen.findByRole('button', { name: /^edit$/i }))
    const save = await screen.findByRole('button', { name: /save changes/i })
    const form = save.closest('form') as HTMLFormElement
    const title = within(form).getAllByRole('textbox')[0] as HTMLInputElement
    expect(title).toHaveValue('My own post')
    expect(within(form).getByRole('checkbox', { name: /no smoking/i })).toBeChecked()
    expect(form.querySelectorAll('img')).toHaveLength(2)

    // Removing photo 1 is not allowed to go through.
    await user.click(within(form).getAllByRole('button', { name: /remove photo/i })[0] as HTMLElement)
    await user.click(save)
    expect(await screen.findByText(/photo 1 is required/i)).toBeInTheDocument()
    expect(roommateCalls(calls, 'PUT')).toHaveLength(0)

    await user.upload(form.querySelectorAll<HTMLInputElement>('input[type="file"]')[0] as HTMLInputElement, photo('new.jpg'))
    await user.clear(title)
    await user.type(title, 'Renamed post')
    await user.click(save)

    await waitFor(() => expect(roommateCalls(calls, 'PUT')).toHaveLength(1))
    const put = roommateCalls(calls, 'PUT')[0]
    expect(put?.url).toMatch(/\/roommates\/rm-mine$/)
    expect(put?.body).toMatchObject({
      houseId: 'h1',
      occupationId: 'occ1',
      title: 'Renamed post',
      isNoSmoking: true,
      photos: ['uploads/profile/new-1.jpg', 'uploads/profile/mine-2.jpg'],
    })
    expect(await screen.findByText(/roommate post updated/i)).toBeInTheDocument()
  })

  it('deletes the owner post only after confirmation', async () => {
    const { calls, user } = setup()
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/my own post/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(roommateCalls(calls, 'DELETE')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(roommateCalls(calls, 'DELETE')).toHaveLength(1))
    expect(roommateCalls(calls, 'DELETE')[0]?.url).toMatch(/\/roommates\/rm-mine$/)
    await waitFor(() => expect(screen.queryByText('My own post')).toBeNull())
    expect(screen.getByText('Legacy post')).toBeInTheDocument()
  })
})
