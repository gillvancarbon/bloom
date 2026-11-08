import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS, normalizeSettings, settingsStore } from '../data/settingsStore'
import { backupStore } from '../data/backupStore'
import { runMigrations } from '../data/migrations'
import { freezeRefillPatch } from '../lib/freezes'

interface SettingsContextValue {
  settings: Settings
  /** True once the stored settings have been read. */
  ready: boolean
  update: (patch: Partial<Settings> | ((prev: Settings) => Partial<Settings>)) => void
  /** Replace settings wholesale (used after a restore). */
  replace: (next: Settings) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  /**
   * Mirror of the latest settings. `update` resolves functional patches and
   * computes the next value outside the state updater, which must stay pure —
   * StrictMode otherwise runs it twice and can persist a discarded value.
   */
  const settingsRef = useRef(settings)

  const persist = useCallback((next: Settings) => {
    // Serialise writes so rapid toggles can't race and clobber each other.
    writeQueue.current = writeQueue.current
      .then(() => settingsStore.write(next))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      await runMigrations()
      const stored = await settingsStore.read()
      if (cancelled) return
      // Top up streak freezes for the new week before the UI reads them.
      const refill = freezeRefillPatch(stored, new Date())
      const initial = refill ? normalizeSettings({ ...stored, ...refill }) : stored
      settingsRef.current = initial
      setSettings(initial)
      setReady(true)
      if (refill) persist(initial)

      // Automatic daily local backup — never block the UI on it.
      if (stored.autoBackupEnabled) {
        backupStore
          .createIfDue(true)
          .then((backup) => {
            if (backup && !cancelled) {
              const merged = normalizeSettings({ ...settingsRef.current, lastBackupAt: backup.at })
              settingsRef.current = merged
              setSettings(merged)
              persist(merged)
            }
          })
          .catch(() => undefined)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [persist])

  const update = useCallback(
    (patch: Partial<Settings> | ((prev: Settings) => Partial<Settings>)) => {
      const prev = settingsRef.current
      const resolved = typeof patch === 'function' ? patch(prev) : patch
      const next = normalizeSettings({ ...prev, ...resolved })
      settingsRef.current = next
      setSettings(next)
      persist(next)
    },
    [persist],
  )

  const replace = useCallback(
    (next: Settings) => {
      const normalized = normalizeSettings(next)
      settingsRef.current = normalized
      setSettings(normalized)
      persist(normalized)
    },
    [persist],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, update, replace }),
    [settings, ready, update, replace],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
