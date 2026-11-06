import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Portal } from './Portal'
import { onToast, type ToastMessage } from '../lib/toast'

/** How long a toast stays on screen before fading. */
const LIFETIME_MS = 5000

/**
 * The single place toasts appear. Mounted once at the app root so any part of
 * the app (including notification actions handled outside React) can publish a
 * message with {@link showToast}. Announced politely to screen readers.
 */
export function ToastHost() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return onToast((message) => {
      if (timer.current) clearTimeout(timer.current)
      setToast(message)
      timer.current = setTimeout(() => setToast(null), LIFETIME_MS)
    })
  }, [])

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const isError = toast?.tone === 'error'

  return (
    <Portal>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              role="status"
              aria-live="polite"
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-calm border
                         border-line bg-raised px-4 py-3 shadow-calm-lg"
            >
              {isError ? (
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-peach-600 dark:text-peach-300"
                  aria-hidden
                />
              ) : (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-sage-600 dark:text-sage-300"
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 text-sm text-ink">{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  )
}
