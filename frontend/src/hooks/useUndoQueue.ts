import { useCallback, useEffect, useRef, useState } from 'react'

export interface UndoItem {
  message: string
  undoLabel?: string
  /** Run when the user taps Undo (or the item is replaced). */
  onUndo: () => void
  /** Run when the undo window closes without an undo. */
  onCommit: () => void
}

/**
 * A tiny single-slot "undo" queue. While an item is pending it is displayed as
 * a snackbar; after `timeoutMs` the change is committed. A new item commits the
 * previous one immediately, so nothing is silently dropped.
 */
export function useUndoQueue(timeoutMs = 6000) {
  const [item, setItem] = useState<UndoItem | null>(null)
  const pending = useRef<UndoItem | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const push = useCallback(
    (next: UndoItem) => {
      // Commit whatever was already pending — only one undo slot exists.
      if (pending.current) pending.current.onCommit()
      clearTimer()
      pending.current = next
      setItem(next)
      timer.current = setTimeout(() => {
        const cur = pending.current
        pending.current = null
        setItem(null)
        cur?.onCommit()
      }, timeoutMs)
    },
    [timeoutMs],
  )

  const undo = useCallback(() => {
    const cur = pending.current
    clearTimer()
    pending.current = null
    setItem(null)
    cur?.onUndo()
  }, [])

  const commitNow = useCallback(() => {
    const cur = pending.current
    clearTimer()
    pending.current = null
    setItem(null)
    cur?.onCommit()
  }, [])

  useEffect(() => clearTimer, [])

  return { item, push, undo, commitNow }
}
