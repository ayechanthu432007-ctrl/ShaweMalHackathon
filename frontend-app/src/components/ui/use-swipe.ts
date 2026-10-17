import { useRef, type TouchEvent } from 'react'

/**
 * Horizontal swipe on a paged (non-scrolling) carousel: a left swipe goes to the next page,
 * a right swipe to the previous one. Vertical scrolling is left alone.
 */
export function useSwipe({ onPrev, onNext, threshold = 40 }: { onPrev: () => void; onNext: () => void; threshold?: number }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0]
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current
      const touch = event.changedTouches[0]
      start.current = null
      if (!from || !touch) return
      const dx = touch.clientX - from.x
      const dy = touch.clientY - from.y
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) onNext()
      else onPrev()
    },
  }
}
