import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusable(container: HTMLElement): HTMLElement[] {
  // jsdom (used by the component tests) has no layout, so every element would
  // look hidden. Only apply the geometry check when the document really lays
  // out, while still excluding explicitly hidden controls everywhere.
  const hasLayout = document.body.getClientRects().length > 0
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
      return false
    }
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (!hasLayout) return true
    return element.offsetParent !== null || element.getClientRects().length > 0
  })
}

/**
 * Keep keyboard focus inside a modal overlay.
 *
 * On mount the first control is focused (or the container itself when it has no
 * controls), Tab and Shift+Tab wrap around inside it, and focus returns to the
 * control that opened the dialog when it closes. Screen readers and keyboard
 * users therefore can't drift onto the page hidden behind the overlay.
 *
 * Attach the returned ref to the dialog's outermost meaningful element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus inside. Prefer the first control; fall back to the container.
    const first = focusable(container)[0]
    if (first) {
      first.focus()
    } else {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !container) return
      const items = focusable(container)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === firstItem || !container.contains(active))) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && (active === lastItem || !container.contains(active))) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [])

  return ref
}
