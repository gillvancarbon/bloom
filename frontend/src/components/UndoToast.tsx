import { AnimatePresence, motion } from 'framer-motion'
import { Undo2 } from 'lucide-react'
import { Portal } from './Portal'
import type { UndoItem } from '../hooks/useUndoQueue'

interface UndoToastProps {
  item: UndoItem | null
  onUndo: () => void
  onDismiss: () => void
}

/** A calm snackbar that offers a single "Undo" for the last action. */
export function UndoToast({ item, onUndo, onDismiss }: UndoToastProps) {
  return (
    <Portal>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[61] flex justify-center px-4"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <AnimatePresence>
          {item && (
            <motion.div
              key={item.message}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              role="status"
              aria-live="polite"
              className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3
                         rounded-calm border border-line bg-raised px-4 py-3 shadow-calm-lg"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.message}</span>
              <button
                type="button"
                onClick={onUndo}
                className="silicone inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-sage-600 dark:text-sage-300"
              >
                <Undo2 className="h-4 w-4" aria-hidden />
                {item.undoLabel ?? 'Undo'}
              </button>
              <button type="button" onClick={onDismiss} aria-label="Dismiss" className="sr-only">
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  )
}
