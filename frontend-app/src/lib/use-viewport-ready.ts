import { useEffect, useRef, useState } from 'react'

type UseViewportReadyOptions = {
  rootMargin?: string
  initialVisible?: boolean
}

export function useViewportReady({ rootMargin = '200px 0px', initialVisible = true }: UseViewportReadyOptions = {}) {
  const ref = useRef<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(initialVisible)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsVisible(true)
      return
    }

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const node = ref.current
    if (!node) {
      setIsVisible(initialVisible)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry) return
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [initialVisible, rootMargin])

  return { ref, isVisible }
}
