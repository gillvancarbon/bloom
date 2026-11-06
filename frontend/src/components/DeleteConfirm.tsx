import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { AlertTriangle } from 'lucide-react'

interface DeleteConfirmProps {
  name: string
  title?: string
  description?: ReactNode
  cancelLabel?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteConfirm({
  name,
  title = 'Delete this?',
  description = 'will be permanently removed. This can’t be undone.',
  cancelLabel = 'Keep it',
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const trapRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, deleting])

  async function handleConfirm() {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
      >
        <div
          className="absolute inset-0 bg-sage-900/30 dark:bg-black/50"
          onClick={() => !deleting && onCancel()}
          aria-hidden
        />
        <motion.div
          ref={trapRef}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative z-10 max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-calm bg-raised p-6 shadow-calm-lg"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-peach-100 text-peach-600 dark:bg-peach-900/50 dark:text-peach-300">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>

          <h2 id="delete-title" className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <p id="delete-desc" className="mt-2 text-sm text-muted">
            <span className="font-medium text-ink">“{name}”</span> {description}
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="silicone-quiet rounded-full px-4 py-2 text-sm font-medium
                         hover:text-ink dark:hover:text-ink disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleting}
              className="silicone-danger rounded-full px-5 py-2 text-sm font-semibold
                         disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  )
}
