import { useCallback, useEffect, useRef, useState } from 'react'

import { CarouselControls } from '@/components/ui/carousel-controls'
import { HouseCard } from '@/features/houses/components/HouseCard'
import type { HouseListItem } from '@/features/houses/types'

type HouseCarouselProps = {
  houses: HouseListItem[]
  label: string
}

/**
 * House cards side by side in one row. Prev and Next move the row by exactly one card,
 * and the dots show (and jump to) the current position. Swiping still works on touch screens.
 */
export function HouseCarousel({ houses, label }: HouseCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [positions, setPositions] = useState(1)
  /** The position a Prev/Next/dot click is sliding towards; scroll events on the way there are ignored. */
  const slidingTo = useRef<number | null>(null)

  /** Distance from one card's left edge to the next: the card width plus the gap. */
  const stepWidth = useCallback(() => {
    const track = trackRef.current
    const first = track?.children[0] as HTMLElement | undefined
    const second = track?.children[1] as HTMLElement | undefined
    if (!first) return 0
    return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
  }, [])

  // How many places the row can stop at depends on how many cards fit, so it follows the screen width.
  const measure = useCallback(() => {
    const track = trackRef.current
    const step = stepWidth()
    if (!track || step === 0) return
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth)
    setPositions(Math.round(maxScroll / step) + 1)
    setIndex(Math.round(track.scrollLeft / step))
  }, [stepWidth])

  useEffect(() => {
    measure()
    const track = trackRef.current
    if (!track) return
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(track)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [measure, houses.length])

  const goTo = (target: number) => {
    const track = trackRef.current
    if (!track) return
    const next = Math.max(0, Math.min(positions - 1, target))
    slidingTo.current = next
    // If the slide is interrupted (a swipe, a resize), stop waiting for it.
    window.setTimeout(() => {
      if (slidingTo.current === next) slidingTo.current = null
    }, 1000)
    track.scrollTo?.({ left: next * stepWidth(), behavior: 'smooth' })
    setIndex(next)
  }

  const last = positions - 1

  return (
    <div className="space-y-4">
      <ul
        ref={trackRef}
        aria-label={label}
        // Swiping or scrolling the row keeps the dots in step with it.
        onScroll={() => {
          const step = stepWidth()
          if (!trackRef.current || step === 0) return
          const position = Math.min(last, Math.round(trackRef.current.scrollLeft / step))
          if (slidingTo.current !== null) {
            if (position === slidingTo.current) slidingTo.current = null
            return
          }
          setIndex(position)
        }}
        className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 py-1"
      >
        {houses.map((house) => (
          <li key={house.id} className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]">
            <HouseCard house={house} className="h-full" />
          </li>
        ))}
      </ul>

      <CarouselControls index={index} count={positions} onChange={goTo} />
    </div>
  )
}
