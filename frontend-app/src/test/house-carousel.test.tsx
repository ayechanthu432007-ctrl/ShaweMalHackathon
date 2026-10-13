import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HouseCarousel } from '@/features/home/components/HouseCarousel'
import { renderWithProviders } from '@/test/utils'

const CARD = 284
const GAP = 16
const VISIBLE = 3

const houses = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `h${index + 1}`, title: `House ${index + 1}`, monthlyFees: 100000 * (index + 1), availability: 'available' }))

/** jsdom has no layout, so the row is given the sizes a three-card-wide screen would produce. */
function fakeLayout(scrollTo: (options: ScrollToOptions) => void) {
  const original = {
    offsetLeft: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft'),
    offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth'),
    clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth'),
    scrollTo: Element.prototype.scrollTo,
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get(this: HTMLElement) {
      return this.tagName === 'LI' && this.parentElement ? [...this.parentElement.children].indexOf(this) * (CARD + GAP) : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => CARD })
  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      return this.tagName === 'UL' ? this.children.length * (CARD + GAP) - GAP : 0
    },
  })
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => VISIBLE * (CARD + GAP) - GAP })
  Element.prototype.scrollTo = scrollTo as typeof Element.prototype.scrollTo

  return () => {
    if (original.offsetLeft) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', original.offsetLeft)
    if (original.offsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original.offsetWidth)
    if (original.scrollWidth) Object.defineProperty(Element.prototype, 'scrollWidth', original.scrollWidth)
    if (original.clientWidth) Object.defineProperty(Element.prototype, 'clientWidth', original.clientWidth)
    Element.prototype.scrollTo = original.scrollTo
  }
}

describe('popular houses carousel', () => {
  let restore: () => void
  let scrolls: number[]

  beforeEach(() => {
    scrolls = []
    restore = fakeLayout((options) => scrolls.push(Number(options.left)))
  })
  afterEach(() => restore())

  const dots = () => screen.getAllByRole('button', { name: /go to position/i })
  const currentDot = () => dots().findIndex((dot) => dot.getAttribute('aria-current') === 'true')

  it('moves exactly one card per click and keeps the dots in step', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HouseCarousel houses={houses(5)} label="Popular Houses" />)

    // Five cards, three visible: the row can stop in three places.
    expect(dots()).toHaveLength(3)
    expect(currentDot()).toBe(0)
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(scrolls.at(-1)).toBe(CARD + GAP)
    expect(currentDot()).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(scrolls.at(-1)).toBe(2 * (CARD + GAP))
    expect(currentDot()).toBe(2)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Prev' }))
    expect(scrolls.at(-1)).toBe(CARD + GAP)
    expect(currentDot()).toBe(1)
  })

  it('jumps to a position when its dot is chosen', async () => {
    renderWithProviders(<HouseCarousel houses={houses(5)} label="Popular Houses" />)

    await userEvent.setup().click(dots()[2] as HTMLElement)

    expect(scrolls.at(-1)).toBe(2 * (CARD + GAP))
    expect(currentDot()).toBe(2)
  })

  it('keeps every card in one row and hides the controls when all cards already fit', () => {
    renderWithProviders(<HouseCarousel houses={houses(3)} label="Popular Houses" />)

    expect(screen.getByRole('list', { name: 'Popular Houses' }).children).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(vi.isMockFunction(Element.prototype.scrollTo)).toBe(false)
  })
})
