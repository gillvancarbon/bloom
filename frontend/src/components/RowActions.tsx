import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ArchiveRestore, Leaf, Pencil, Trash2 } from 'lucide-react'

interface RowActionsProps {
  id: number
  label: string
  /** Whether the habit is currently archived (swaps the action to Restore). */
  archived?: boolean
  open: boolean
  onToggle: () => void
  onEdit: () => void
  /** Omit for rows that don't support archiving. */
  onArchive?: () => void
  onDelete: () => void
}

/** A single action button is a 44px square, clearing the touch-target minimum. */
const BUTTON = 44
/** Breathing room kept inside the clipping viewport so the buttons' soft
 *  neomorphic shadows are never cut off at the edges. */
const PAD = 8

/** Three 44px buttons + two 8px gaps, or two buttons when archive is absent. */
const openWidth = (hasArchive: boolean) => (hasArchive ? 148 : 96)
/** The animated viewport width: the button row plus equal padding each side. */
const viewportWidth = (open: boolean, hasArchive: boolean) =>
  (open ? openWidth(hasArchive) : BUTTON) + PAD * 2

/** The leaf → edit + archive + delete interaction shared by cards. */
export function RowActions({
  id,
  label,
  archived = false,
  open,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
}: RowActionsProps) {
  const hasArchive = typeof onArchive === 'function'
  return (
    <motion.div
      className="relative flex shrink-0 items-center justify-end overflow-hidden"
      style={{ height: BUTTON + PAD * 2 }}
      data-actions-for={id}
      animate={{ width: viewportWidth(open, hasArchive) }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
    >
      <AnimatePresence initial={false}>
        {!open ? (
          <motion.button
            key="leaf"
            type="button"
            onClick={onToggle}
            aria-label={`Show actions for ${label}`}
            aria-expanded={false}
            style={{ right: PAD }}
            className="silicone absolute flex h-11 w-11 items-center justify-center rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.span
              className="flex"
              initial={{ rotate: -180, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Leaf
                className="h-[24px] w-[24px] text-sage-500 dark:text-sage-300"
                strokeWidth={2}
                aria-hidden
              />
            </motion.span>
          </motion.button>
        ) : (
          <motion.div
            key="actions"
            style={{ right: PAD }}
            className="absolute flex items-center gap-2"
            initial={{ opacity: 0, x: 10, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.9 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${label}`}
              title="Edit"
              className="silicone flex h-11 w-11 items-center justify-center rounded-full"
            >
              <Pencil className="h-5 w-5 text-muted" aria-hidden />
            </button>
            {hasArchive && (
              <button
                type="button"
                onClick={onArchive}
                aria-label={`${archived ? 'Restore' : 'Archive'} ${label}`}
                title={archived ? 'Restore' : 'Archive'}
                className="silicone flex h-11 w-11 items-center justify-center rounded-full"
              >
                {archived ? (
                  <ArchiveRestore
                    className="h-5 w-5 text-sage-600 dark:text-sage-300"
                    aria-hidden
                  />
                ) : (
                  <Archive className="h-5 w-5 text-muted" aria-hidden />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${label}`}
              title="Delete"
              className="silicone flex h-11 w-11 items-center justify-center rounded-full"
            >
              <Trash2 className="h-5 w-5 text-peach-600 dark:text-peach-300" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
