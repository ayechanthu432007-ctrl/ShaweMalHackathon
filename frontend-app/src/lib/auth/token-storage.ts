const ACCESS_TOKEN_KEY = 'shwemal.accessToken'
const REFRESH_TOKEN_KEY = 'shwemal.refreshToken'
const CHANNEL_NAME = 'shwemal.session'

/**
 * Without "Remember me" the session lives in sessionStorage, which every browser tab keeps
 * to itself. Opening the site in another tab (for example from a link in the Telegram bot)
 * would look signed out, so tabs of the same browser hand the session to each other over a
 * BroadcastChannel. Nothing is written to disk: closing the browser still ends the session.
 */
type SessionMessage =
  | { type: 'request' }
  | { type: 'tokens'; accessToken: string; refreshToken: string | null }
  | { type: 'cleared' }

type SessionChange = 'received' | 'cleared'

const listeners = new Set<(change: SessionChange) => void>()
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)

function post(message: SessionMessage): void {
  try {
    channel?.postMessage(message)
  } catch {
    // A closed channel only means other tabs are not told; this tab keeps working.
  }
}

function tabSession(): { accessToken: string; refreshToken: string | null } | null {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  return accessToken ? { accessToken, refreshToken: sessionStorage.getItem(REFRESH_TOKEN_KEY) } : null
}

if (channel) {
  channel.onmessage = (event: MessageEvent<SessionMessage>) => {
    const message = event.data
    if (!message || typeof message !== 'object') return

    if (message.type === 'request') {
      const session = tabSession()
      if (session) post({ type: 'tokens', ...session })
      return
    }

    // A remembered session is already shared through localStorage.
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) return

    if (message.type === 'tokens' && typeof message.accessToken === 'string') {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, message.accessToken)
      if (message.refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, message.refreshToken)
      listeners.forEach((listener) => listener('received'))
    } else if (message.type === 'cleared' && tabSession()) {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      sessionStorage.removeItem(REFRESH_TOKEN_KEY)
      listeners.forEach((listener) => listener('cleared'))
    }
  }
}

function read(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function write(key: string, value: string, rememberMe: boolean): void {
  const primary = rememberMe ? localStorage : sessionStorage
  const secondary = rememberMe ? sessionStorage : localStorage
  primary.setItem(key, value)
  secondary.removeItem(key)
}

function remove(key: string): void {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

/** Tells the other tabs about this tab's session after it was created or renewed. */
function share(): void {
  const session = tabSession()
  if (session) post({ type: 'tokens', ...session })
}

export const tokenStorage = {
  getAccessToken(): string | null {
    return read(ACCESS_TOKEN_KEY)
  },
  setAccessToken(token: string, rememberMe = true): void {
    write(ACCESS_TOKEN_KEY, token, rememberMe)
    share()
  },
  getRefreshToken(): string | null {
    return read(REFRESH_TOKEN_KEY)
  },
  setRefreshToken(token: string, rememberMe = true): void {
    write(REFRESH_TOKEN_KEY, token, rememberMe)
    share()
  },
  setTokens(accessToken: string, refreshToken?: string, rememberMe = true): void {
    write(ACCESS_TOKEN_KEY, accessToken, rememberMe)
    if (refreshToken) {
      write(REFRESH_TOKEN_KEY, refreshToken, rememberMe)
    }
    share()
  },
  clear(): void {
    const hadTabSession = Boolean(tabSession())
    remove(ACCESS_TOKEN_KEY)
    remove(REFRESH_TOKEN_KEY)
    if (hadTabSession) post({ type: 'cleared' })
  },
  /** True when another tab of this browser could hold a session to hand over. */
  canAskOtherTabs(): boolean {
    return channel !== null
  },
  /** Asks the other tabs for their session; an answer arrives through `subscribe`. */
  requestFromOtherTabs(): void {
    post({ type: 'request' })
  },
  /** Runs when another tab hands over its session or signs out. */
  subscribe(listener: (change: SessionChange) => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
