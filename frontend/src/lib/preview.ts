/**
 * Opt-in phone-sized preview for the web build.
 *
 * Add `?phone` to the URL to render the app inside a real phone-sized iframe
 * (default 393 × 873). Using an iframe matters: media queries such as `sm:`
 * resolve against the iframe viewport, so the preview matches the APK rather
 * than the desktop window. Override the size with `?phone&w=393&h=873`.
 *
 * Returns `true` when the outer page has taken over and the app should not
 * render in the top-level document.
 */
export function setupPhonePreview(): boolean {
  if (typeof document === 'undefined') return false

  const params = new URLSearchParams(window.location.search)

  // The framed app renders normally, just without scrollbars.
  if (params.has('embed')) {
    document.documentElement.classList.add('phone-embed')
    return false
  }

  if (!params.has('phone')) return false

  const width = Number(params.get('w')) || 393
  const height = Number(params.get('h')) || 873

  // Load the app itself inside the frame, without the preview flags.
  const inner = new URL(window.location.href)
  inner.searchParams.delete('phone')
  inner.searchParams.delete('w')
  inner.searchParams.delete('h')
  inner.searchParams.set('embed', '1')

  const frame = document.createElement('div')
  frame.className = 'phone-frame'
  frame.style.width = `${width}px`
  frame.style.height = `${height}px`

  const view = document.createElement('iframe')
  view.className = 'phone-frame-view'
  view.title = `Bloom preview at ${width} by ${height}`
  view.src = inner.toString()

  const caption = document.createElement('span')
  caption.className = 'phone-frame-caption'
  caption.textContent = `${width} × ${height}`

  frame.append(view, caption)
  document.body.appendChild(frame)
  document.documentElement.classList.add('phone-preview')
  document.title = `Bloom · ${width}×${height} preview`
  return true
}
