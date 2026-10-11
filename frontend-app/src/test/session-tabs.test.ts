import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokenStorage } from '@/lib/auth/token-storage'

type Message = { type: string; accessToken?: string; refreshToken?: string | null }

/** Stands in for a second tab of the same browser. */
const openOtherTab = () => {
  const channel = new BroadcastChannel('shwemal.session')
  const received: Message[] = []
  channel.onmessage = (event: MessageEvent<Message>) => received.push(event.data)
  return { channel, received }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

describe('session shared between tabs', () => {
  let other: ReturnType<typeof openOtherTab>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    other = openOtherTab()
  })
  afterEach(() => other.channel.close())

  it('hands a session that is not remembered to a tab that asks for it', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1', false)
    await settle()
    other.received.length = 0

    other.channel.postMessage({ type: 'request' })
    await settle()

    expect(other.received).toEqual([{ type: 'tokens', accessToken: 'access-1', refreshToken: 'refresh-1' }])
  })

  it('takes over the session another tab hands over, and renewed tokens after that', async () => {
    const changes: string[] = []
    const unsubscribe = tokenStorage.subscribe((change) => changes.push(change))

    other.channel.postMessage({ type: 'tokens', accessToken: 'access-1', refreshToken: 'refresh-1' })
    await settle()
    expect(tokenStorage.getAccessToken()).toBe('access-1')

    other.channel.postMessage({ type: 'tokens', accessToken: 'access-2', refreshToken: 'refresh-2' })
    await settle()
    expect(tokenStorage.getRefreshToken()).toBe('refresh-2')
    expect(localStorage.length).toBe(0)
    expect(changes).toEqual(['received', 'received'])
    unsubscribe()
  })

  it('signs this tab out when another tab signs out', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1', false)
    const changes: string[] = []
    const unsubscribe = tokenStorage.subscribe((change) => changes.push(change))

    other.channel.postMessage({ type: 'cleared' })
    await settle()

    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(changes).toEqual(['cleared'])
    unsubscribe()
  })

  it('leaves a remembered session alone and never broadcasts it', async () => {
    tokenStorage.setTokens('remembered', 'remembered-refresh', true)
    await settle()
    other.channel.postMessage({ type: 'request' })
    other.channel.postMessage({ type: 'tokens', accessToken: 'other', refreshToken: 'other-refresh' })
    other.channel.postMessage({ type: 'cleared' })
    await settle()

    expect(other.received).toEqual([])
    expect(tokenStorage.getAccessToken()).toBe('remembered')
  })
})
