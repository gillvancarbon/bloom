import { useCallback, useEffect, useRef, useState } from 'react'

/** How many rows to add each time the end of the window is reached. */
const DEFAULT_PAGE = 30

/**
 * Keep long lists cheap to render by mounting a page at a time.
 *
 * Rather than mounting every row (which is slow once a list runs into the
 * hundreds), only the first `pageSize` are rendered. An intersection sentinel
 * grows the window as the user scrolls near the end, and a "Show more" button
 * provides the same action for anyone who can't scroll or has no
 * IntersectionObserver (e.g. jsdom in tests).
 */
export function useWindowedList<T>(items: T[], pageSize = DEFAULT_PAGE) {
  const [limit, setLimit] = useState(pageSize)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // A shorter list should never stay capped from a previous, longer one.
  useEffect(() => {
    setLimit((current) => Math.min(current, Math.max(pageSize, items.length)))
  }, [items.length, pageSize])

  const showMore = useCallback(() => {
    setLimit((current) => Math.min(current + pageSize, items.length))
  }, [items.length, pageSize])

  const hasMore = items.length > limit
  const visible = items.slice(0, Math.max(limit, 0))

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) showMore()
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, showMore])

  return { visible, hasMore, showMore, sentinelRef }
}
