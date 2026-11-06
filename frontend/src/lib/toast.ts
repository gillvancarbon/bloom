/**
 * A tiny in-app toast bus.
 *
 * Some work happens outside React — most notably a notification action tapped
 * while the app is backgrounded. When that work fails there may be no screen
 * mounted to show an error, so failures are published here and a single host
 * component surfaces them, giving every failure the same calm message style.
 */

export type ToastTone = 'info' | 'error'

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
}

const EVENT = 'bloom:toast'
let nextId = 1

export function showToast(text: string, tone: ToastTone = 'info'): void {
  if (typeof window === 'undefined' || !text) return
  const detail: ToastMessage = { id: nextId++, text, tone }
  window.dispatchEvent(new CustomEvent<ToastMessage>(EVENT, { detail }))
}

/** Subscribe to toasts; returns an unsubscribe function. */
export function onToast(handler: (message: ToastMessage) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event) => handler((event as CustomEvent<ToastMessage>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
