import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/app/providers/AuthProvider'
import { SignInPage } from '@/features/auth/pages/SignInPage'
import { SignUpPage } from '@/features/auth/pages/SignUpPage'
import { renderWithProviders } from '@/test/utils'

type Account = { id: string; name: string; email: string; phone: string; password: string }

/** A stand-in for the API that keeps accounts the way the real one does. */
function stubAuthServer(accounts: Account[]) {
  const sessions = new Map<string, Account>()
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const ok = (data: unknown, status = 200) => reply(status, { success: true, message: 'ok', data })
  const fail = (status: number, code: string, message: string) => reply(status, { success: false, message, errors: { code } })
  const token = (account: Account) => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: account.id }))
    const value = `${btoa('{"alg":"none"}')}.${payload}.${Math.random().toString(36).slice(2)}`
    sessions.set(value, account)
    return value
  }
  const safe = (account: Account) => ({ id: account.id, name: account.name, email: account.email, phone: account.phone, roles: ['normal'] })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {}
      const email = (body.email ?? '').trim().toLowerCase()

      if (url.includes('/master-data/occupations')) return ok({ items: [{ id: 'occ-student', name: 'Student' }] })
      if (url.includes('/auth/register')) {
        if (accounts.some((account) => account.email === email)) return fail(409, 'AUTH_EMAIL_EXISTS', 'This email is already registered.')
        if (accounts.some((account) => account.phone === body.phone)) return fail(409, 'AUTH_PHONE_EXISTS', 'This phone number is already used.')
        const account = { id: `user-${accounts.length + 1}`, name: body.name ?? '', email, phone: body.phone ?? '', password: body.password ?? '' }
        accounts.push(account)
        return ok({ user: safe(account), accessToken: token(account), refreshToken: 'unused' }, 201)
      }
      if (url.includes('/auth/login')) {
        const account = accounts.find((item) => item.email === email && item.password === body.password)
        if (!account) return fail(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.')
        return ok({ user: safe(account), accessToken: token(account), refreshToken: `refresh-${account.id}` })
      }
      if (url.includes('/auth/logout')) return ok({ ok: true })
      if (url.includes('/auth/verify')) {
        const bearer = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? ''
        const account = sessions.get(bearer)
        return account ? ok({ user: safe(account) }) : fail(401, 'AUTH_INVALID_TOKEN', 'Invalid token.')
      }
      return fail(404, 'NOT_FOUND', 'Not found')
    }),
  )
}

function Home() {
  const { user, logout } = useAuth()
  return (
    <div>
      <p>{user ? `Signed in as ${user.name}` : 'Signed out'}</p>
      <button type="button" onClick={() => void logout()}>
        Sign out
      </button>
    </div>
  )
}

const renderApp = (start: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
    </Routes>,
    { initialEntries: [start] },
  )

const field = (id: string) => document.getElementById(id) as HTMLInputElement

async function fillSignUp(user: ReturnType<typeof userEvent.setup>, details: { email: string; phone: string }) {
  await screen.findByRole('option', { name: 'Student' })
  for (const id of ['name', 'email', 'phone', 'password', 'confirmPassword']) await user.clear(field(id))
  await user.type(field('name'), 'New Person')
  await user.type(field('email'), details.email)
  await user.type(field('phone'), details.phone)
  await user.selectOptions(field('occupationId'), 'occ-student')
  await user.type(field('password'), 'Passw0rd!')
  await user.type(field('confirmPassword'), 'Passw0rd!')
  await user.click(screen.getByRole('button', { name: 'Register' }))
}

describe('creating an account and signing in', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('registers, signs in, signs out and signs in again with the same details', async () => {
    stubAuthServer([])
    const user = userEvent.setup()
    renderApp('/sign-up')

    await fillSignUp(user, { email: 'New.Person@Example.com', phone: '0912345678' })

    // Sign-up lands on the sign-in form, which confirms the account and holds the address.
    expect(await screen.findByText(/your account was created/i)).toHaveTextContent('New.Person@Example.com')
    expect(field('email')).toHaveValue('New.Person@Example.com')

    await user.type(field('password'), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByText('Signed in as New Person')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByText('Signed out')).toBeInTheDocument()
    expect(sessionStorage.getItem('shwemal.accessToken')).toBeNull()
  })

  it('signs back in after signing out', async () => {
    stubAuthServer([{ id: 'user-1', name: 'New Person', email: 'new.person@example.com', phone: '0912345678', password: 'Passw0rd!' }])
    const user = userEvent.setup()
    renderApp('/sign-in')

    await user.type(field('email'), 'new.person@example.com')
    await user.type(field('password'), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Signed in as New Person')).toBeInTheDocument()
  })

  it('says which detail is already registered instead of a generic failure', async () => {
    stubAuthServer([{ id: 'user-1', name: 'Existing', email: 'taken@example.com', phone: '0911111111', password: 'x' }])
    const user = userEvent.setup()
    renderApp('/sign-up')

    await fillSignUp(user, { email: 'taken@example.com', phone: '0922222222' })
    expect(await screen.findByText(/this email is already registered/i)).toBeInTheDocument()
    expect(screen.queryByText(/registration failed/i)).not.toBeInTheDocument()

    await fillSignUp(user, { email: 'fresh@example.com', phone: '0911111111' })
    expect(await screen.findByText(/this phone number is already used/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/this email is already registered/i)).not.toBeInTheDocument())
  })

  it('reports a wrong password as wrong credentials', async () => {
    stubAuthServer([{ id: 'user-1', name: 'Existing', email: 'taken@example.com', phone: '0911111111', password: 'right-password' }])
    const user = userEvent.setup()
    renderApp('/sign-in')

    await user.type(field('email'), 'taken@example.com')
    await user.type(field('password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText(/login failed/i)).toBeInTheDocument()
  })
})
