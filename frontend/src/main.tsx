import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { SettingsProvider } from './context/SettingsContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { flushPendingDeletes } from './data/pendingDeletes'
import { setupPhonePreview } from './lib/preview'
import './index.css'

/** Keep the startup splash up briefly so the app feels ready, not flashing. */
const SPLASH_MIN_MS = 480
const startedAt = performance.now()

function dismissSplash(): void {
  const splash = document.getElementById('bloom-splash')
  if (!splash) return
  splash.classList.add('bloom-splash--hide')
  window.setTimeout(() => splash.remove(), 320)
}

async function start() {
  // ?phone renders the app inside a phone-sized iframe instead.
  if (setupPhonePreview()) {
    dismissSplash()
    return
  }

  // Apply any deletions that were still inside their undo window when the app
  // last closed, so a row can't reappear after a reload.
  await flushPendingDeletes().catch(() => undefined)

  const elapsed = performance.now() - startedAt
  if (elapsed < SPLASH_MIN_MS) {
    await new Promise((resolve) => window.setTimeout(resolve, SPLASH_MIN_MS - elapsed))
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>,
  )

  // Let the first frame paint, then fade the splash away over it.
  requestAnimationFrame(() => requestAnimationFrame(dismissSplash))
}

void start()
