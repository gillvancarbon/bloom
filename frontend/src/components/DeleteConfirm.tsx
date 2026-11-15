import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'

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
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="relative z-10 max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-calm-lg bg-raised p-6 shadow-calm-lg"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-peach-500/10 text-peach-600 dark:bg-peach-400/10 dark:text-peach-300">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>

          <h2
            id="delete-title"
            className="font-display text-lg font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
          <p id="delete-desc" className="mt-2 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">“{name}”</span> {description}
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={deleting}>
              {cancelLabel}
            </Button>
            <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
              {deleting ? 'Deleting…' : confirmLabel}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  )
}
