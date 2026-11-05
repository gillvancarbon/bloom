import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders overlays at the document root. This keeps dialogs above the fixed
 * bottom navigation and avoids transformed page wrappers affecting `fixed`
 * positioning.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
