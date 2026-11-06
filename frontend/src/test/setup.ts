import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Component tests share one jsdom document, so unmount between them. The
// import is dynamic to keep the Node-only domain tests from loading RTL.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
