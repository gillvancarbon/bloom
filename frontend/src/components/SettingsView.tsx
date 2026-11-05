import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Portal } from './Portal'
import { Segmented } from './Segmented'
import { DeleteConfirm } from './DeleteConfirm'
import { useSettings } from '../context/SettingsContext'
import { useTheme } from '../context/ThemeContext'
import { backupStore, type Backup } from '../data/backupStore'
import { dataClient } from '../data/dataClient'
import { downloadFile, parseBundle, toJson, type ParsedBundle } from '../lib/export'
import { notifyDataChanged } from '../lib/dataEvents'
import {
  checkNotificationPermission,
  notificationsNative,
  requestNotificationPermission,
} from '../lib/notifications'
import {
  applyReminderSound,
  listSounds,
  playSound,
  soundSupported,
  type SoundOption,
} from '../lib/sound'
import { REMINDER_OPTIONS } from '../lib/reminder'
import { TutorialView } from './TutorialView'
import { AboutView } from './AboutView'
import { APP_VERSION } from '../lib/appInfo'
import {
  ChevronLeft,
  Bell,
  BookOpen,
  Check,
  Info,
  Play,
  Sparkles,
  Database,
  Download,
  Upload,
  Volume2,
  Clock,
} from 'lucide-react'
import type { CompletionSound, TimeFormat, WeekStart } from '../types'

interface SettingsViewProps {
  onClose: () => void
}

/* ── Small building blocks ─────────────────────────────────────────── */

function Section({
  title,
  Icon,
  children,
}: {
  title: string
  Icon: typeof Bell
  children: ReactNode
}) {
  return (
    <section className="rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-sage-500 dark:text-sage-300" aria-hidden />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full border transition-colors duration-calm ease-calm ${
        checked ? 'border-sage-500 bg-sage-500' : 'border-line bg-mint-200 dark:bg-mint-900/60'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-calm ${
          checked ? 'left-6' : 'left-0.5'
        }`}
      />
    </button>
  )
}

/* ── Sound picker sheet ────────────────────────────────────────────── */

function SoundSheet({
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  title: string
  options: SoundOption[]
  selected: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-calm border border-line bg-raised p-4 shadow-calm sm:rounded-calm"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="silicone rounded-full px-4 py-2 text-sm font-semibold"
            >
              Done
            </button>
          </div>
          <ul className="space-y-1">
            {options.map((option) => {
              const isSelected = option.id === selected
              const silent = option.id === 'none'
              return (
                <li key={option.id}>
                  <div
                    className={`flex items-center gap-1 rounded-calm-sm ${
                      isSelected ? 'bg-mint-100 dark:bg-mint-900/40' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onSelect(option.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? 'border-sage-500 bg-sage-500 text-white' : 'border-line'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" aria-hidden />}
                      </span>
                      <span className="min-w-0 truncate text-sm text-ink">{option.title}</span>
                    </button>
                    {!silent && (
                      <button
                        type="button"
                        onClick={() => void playSound(option.id)}
                        aria-label={`Preview ${option.title}`}
                        className="silicone-quiet mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                                   text-muted hover:text-sage-500 dark:hover:text-sage-300"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </motion.div>
      </motion.div>
    </Portal>
  )
}

/* ── Screen ────────────────────────────────────────────────────────── */

export function SettingsView({ onClose }: SettingsViewProps) {
  const { settings, update } = useSettings()
  const { theme, setTheme } = useTheme()
  const [backups, setBackups] = useState<Backup[]>([])
  const [permission, setPermission] = useState<boolean | null>(null)
  const [confirm, setConfirm] = useState<'clear' | Backup | null>(null)
  const [busy, setBusy] = useState(false)
  const [sounds, setSounds] = useState<SoundOption[]>([])
  const [picker, setPicker] = useState<'reminder' | 'completion' | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ParsedBundle | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const soundsAvailable = soundSupported()

  /** Close Settings and let the first-run welcome tour play again. */
  function replayIntro() {
    update({ onboarded: false })
    onClose()
  }

  useEffect(() => {
    if (!soundsAvailable) return
    listSounds().then(setSounds)
  }, [soundsAvailable])

  useEffect(() => {
    backupStore.list().then(setBackups)
    checkNotificationPermission().then(setPermission)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggleNotifications(next: boolean) {
    if (next) {
      const granted = await requestNotificationPermission()
      setPermission(granted)
      update({ notificationsEnabled: granted })
      if (!granted) return
    } else {
      update({ notificationsEnabled: false })
    }
  }

  /** Download everything the user owns as a JSON snapshot. */
  async function exportData() {
    setExporting(true)
    try {
      const { habits, todos } = await dataClient.readAll()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadFile(`bloom-${stamp}.json`, 'application/json', toJson(habits, todos))
    } finally {
      setExporting(false)
    }
  }

  /** Read a chosen file, then ask before replacing anything. */
  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError(null)
    try {
      const bundle = parseBundle(await file.text())
      setPendingImport(bundle)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  /** Replace the dataset from the imported file (after a safety backup). */
  async function confirmImport() {
    if (!pendingImport) return
    await backupStore.create('before import')
    await dataClient.importAll(pendingImport)
    setBackups(await backupStore.list())
    setPendingImport(null)
    notifyDataChanged()
  }

  async function backUpNow() {
    setBusy(true)
    try {
      const backup = await backupStore.create('manual')
      update({ lastBackupAt: backup.at })
      setBackups(await backupStore.list())
    } finally {
      setBusy(false)
    }
  }

  async function doClear() {
    setBusy(true)
    try {
      await dataClient.clearAll()
      // Reset caches by reloading — simplest, most reliable.
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  async function doRestore(backup: Backup) {
    setBusy(true)
    try {
      await backupStore.restore(backup)
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  const lastBackup = settings.lastBackupAt
    ? new Date(settings.lastBackupAt).toLocaleString()
    : 'No backups yet'

  const reminderOptions: SoundOption[] = sounds.length
    ? sounds
    : [
        { id: 'bloom_chime', title: 'Bloom chime (default)' },
        { id: 'default', title: 'Phone default' },
        { id: 'none', title: 'None' },
      ]
  const completionOptions: SoundOption[] = [
    { id: 'same', title: 'Same as reminder' },
    { id: 'none', title: 'None' },
    ...reminderOptions.filter((option) => option.id !== 'none'),
  ]

  function soundLabel(id: string): string {
    if (id === 'same') return 'Same as reminder'
    if (id === 'none') return 'None'
    return reminderOptions.find((option) => option.id === id)?.title ?? 'Bloom chime (default)'
  }

  function chooseReminder(id: string) {
    update({ reminderSound: id })
    // Rebuild the (immutable) Android channel with the new sound.
    void applyReminderSound(id)
    if (id !== 'none') void playSound(id)
    setPicker(null)
  }

  function chooseCompletion(id: CompletionSound) {
    update({ completionSound: id })
    const preview = id === 'same' ? settings.reminderSound : id
    if (preview !== 'none') void playSound(preview)
    setPicker(null)
  }

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-50 overflow-y-auto bg-page"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.section
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="safe-shell relative mx-auto flex min-h-full max-w-xl flex-col gap-4 px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header className="mb-1 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="silicone flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div>
              <h1
                id="settings-title"
                className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                Settings
              </h1>
              <p className="text-xs text-muted sm:text-sm">Tune Bloom to fit your day.</p>
            </div>
          </header>

          {/* Notifications */}
          <Section title="Reminders" Icon={Bell}>
            <Row
              label="Daily reminders"
              hint={
                settings.notificationsEnabled
                  ? permission === false
                    ? 'Turned on, but notifications are blocked in your system settings.'
                    : notificationsNative()
                      ? 'A gentle nudge for each habit, even when the app is closed.'
                      : 'A gentle nudge while this tab stays open (browsers can’t notify once it closes).'
                  : 'Off — no notifications will be scheduled.'
              }
            >
              <Switch
                label="Daily reminders"
                checked={settings.notificationsEnabled}
                onChange={toggleNotifications}
              />
            </Row>
            <Row label="Task reminders" hint="Nudge me when a to-do reaches its due date or time.">
              <Switch
                label="Task reminders"
                checked={settings.taskReminders}
                onChange={(v) => update({ taskReminders: v })}
              />
            </Row>
            <Row
              label="Default reminder"
              hint="New habits start with this, timed to their own deadline."
            >
              <select
                aria-label="Default reminder"
                value={
                  settings.defaultReminderOffset === null
                    ? ''
                    : String(settings.defaultReminderOffset)
                }
                onChange={(e) =>
                  update({
                    defaultReminderOffset: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="max-w-[11rem] rounded-calm-sm border border-line bg-surface py-2 pl-3 pr-2 text-sm text-ink
                           focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value ?? 'none'} value={option.value ?? ''}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Row>
          </Section>

          {/* Sound */}
          <Section title="Sound" Icon={Volume2}>
            <Row
              label="Reminder sound"
              hint={
                soundsAvailable
                  ? 'Plays when a habit reminder fires.'
                  : 'Available in the Android app.'
              }
            >
              <button
                type="button"
                disabled={!soundsAvailable}
                onClick={() => setPicker('reminder')}
                className="silicone max-w-[11rem] truncate rounded-full px-4 py-2 text-sm font-semibold
                           disabled:cursor-not-allowed disabled:opacity-50"
              >
                {soundLabel(settings.reminderSound)}
              </button>
            </Row>
            <Row
              label="Completion sound"
              hint={
                soundsAvailable
                  ? 'The ding when you check something off.'
                  : 'Available in the Android app.'
              }
            >
              <button
                type="button"
                disabled={!soundsAvailable}
                onClick={() => setPicker('completion')}
                className="silicone max-w-[11rem] truncate rounded-full px-4 py-2 text-sm font-semibold
                           disabled:cursor-not-allowed disabled:opacity-50"
              >
                {soundLabel(settings.completionSound)}
              </button>
            </Row>
          </Section>

          {/* Appearance + language/format */}
          <Section title="Appearance" Icon={Sparkles}>
            <Row label="Theme">
              <div className="w-40">
                <Segmented<'light' | 'dark'>
                  ariaLabel="Theme"
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>
            </Row>
            <Row label="Time format">
              <div className="w-40">
                <Segmented<TimeFormat>
                  ariaLabel="Time format"
                  value={settings.timeFormat}
                  onChange={(v) => update({ timeFormat: v })}
                  options={[
                    { value: '12', label: '12h' },
                    { value: '24', label: '24h' },
                  ]}
                />
              </div>
            </Row>
            <Row label="Week starts on">
              <div className="w-40">
                <Segmented<WeekStart>
                  ariaLabel="Week starts on"
                  value={settings.weekStart}
                  onChange={(v) => update({ weekStart: v })}
                  options={[
                    { value: 0, label: 'Sunday' },
                    { value: 1, label: 'Monday' },
                  ]}
                />
              </div>
            </Row>
          </Section>

          {/* Habits */}
          <Section title="Habits" Icon={Clock}>
            <Row
              label="Follow the clock"
              hint="Switch the visible period automatically as morning turns to afternoon and evening."
            >
              <Switch
                label="Follow the clock"
                checked={settings.followClock}
                onChange={(v) => update({ followClock: v })}
              />
            </Row>
            <Row label="Hide completed" hint="Keep finished habits out of the day's list.">
              <Switch
                label="Hide completed"
                checked={settings.hideCompleted}
                onChange={(v) => update({ hideCompleted: v })}
              />
            </Row>
          </Section>

          {/* Data + backups */}
          <Section title="Data & backups" Icon={Database}>
            <Row label="Automatic backups" hint="Snapshots your data on this device once a day.">
              <Switch
                label="Automatic backups"
                checked={settings.autoBackupEnabled}
                onChange={(v) => update({ autoBackupEnabled: v })}
              />
            </Row>
            <Row label="Latest backup" hint={lastBackup}>
              <button
                type="button"
                onClick={backUpNow}
                disabled={busy}
                className="silicone rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Back up now
              </button>
            </Row>
            {backups.length > 0 && (
              <div className="space-y-2 border-t border-line pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Restore points
                </p>
                {backups.slice(0, 5).map((backup) => (
                  <div key={backup.at} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted">
                      {new Date(backup.at).toLocaleString()}
                      <span className="ml-1 text-xs opacity-70">· {backup.reason}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirm(backup)}
                      className="silicone-quiet shrink-0 rounded-full px-3 py-1 text-xs font-semibold
                                 text-sage-600 hover:text-ink dark:text-sage-300"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Row label="Export your data" hint="Download a full JSON snapshot you can keep.">
              <button
                type="button"
                onClick={exportData}
                disabled={exporting}
                className="silicone inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden />
                Export
              </button>
            </Row>
            <Row
              label="Import from JSON"
              hint="Restore habits and tasks from a Bloom export. Replaces what’s here."
            >
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="silicone inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Import
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </Row>
            {importError && (
              <p className="rounded-calm-sm bg-peach-100 px-3 py-2 text-sm text-peach-700 dark:bg-peach-900/40 dark:text-peach-200">
                {importError}
              </p>
            )}
            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setConfirm('clear')}
                className="silicone-quiet w-full rounded-full px-4 py-2 text-sm font-semibold text-peach-600 dark:text-peach-300"
              >
                Clear all habits and tasks
              </button>
            </div>
          </Section>

          {/* Help */}
          <Section title="Help" Icon={BookOpen}>
            <Row label="How to use Bloom" hint="A short tour of every screen and gesture.">
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="silicone inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Open tutorial
              </button>
            </Row>
            <Row label="Welcome tour" hint="Play the first-run introduction again.">
              <button
                type="button"
                onClick={replayIntro}
                className="silicone-quiet rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
              >
                Replay
              </button>
            </Row>
          </Section>

          {/* About */}
          <Section title="About" Icon={Info}>
            <Row label="About Bloom" hint={`Version ${APP_VERSION} · privacy, terms and licences.`}>
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="silicone rounded-full px-4 py-2 text-sm font-semibold"
              >
                Open
              </button>
            </Row>
          </Section>

          <p className="pb-4 text-center text-xs text-muted">
            Bloom · version {APP_VERSION} · stored privately on this device.
          </p>
        </motion.section>
      </motion.div>

      {/* Sound pickers */}
      <AnimatePresence>
        {picker === 'reminder' && (
          <SoundSheet
            title="Reminder sound"
            options={reminderOptions}
            selected={settings.reminderSound}
            onSelect={chooseReminder}
            onClose={() => setPicker(null)}
          />
        )}
        {picker === 'completion' && (
          <SoundSheet
            title="Completion sound"
            options={completionOptions}
            selected={settings.completionSound}
            onSelect={(id) => chooseCompletion(id as CompletionSound)}
            onClose={() => setPicker(null)}
          />
        )}
      </AnimatePresence>

      {/* How-to guide */}
      <AnimatePresence>
        {tutorialOpen && <TutorialView onClose={() => setTutorialOpen(false)} />}
      </AnimatePresence>

      {/* About */}
      <AnimatePresence>
        {aboutOpen && <AboutView onClose={() => setAboutOpen(false)} />}
      </AnimatePresence>

      {/* Confirmations */}
      {confirm === 'clear' && (
        <DeleteConfirm
          name="all habits and tasks"
          title="Clear all data?"
          description="will be permanently removed from this device. Backups are kept, so you can restore from this screen."
          confirmLabel="Clear everything"
          onCancel={() => setConfirm(null)}
          onConfirm={doClear}
        />
      )}
      {confirm && confirm !== 'clear' && (
        <DeleteConfirm
          name={new Date(confirm.at).toLocaleString()}
          title="Restore this backup?"
          description="will replace your current habits and tasks with this snapshot."
          cancelLabel="Cancel"
          confirmLabel="Restore"
          onCancel={() => setConfirm(null)}
          onConfirm={() => doRestore(confirm)}
        />
      )}
      {pendingImport && (
        <DeleteConfirm
          name={`${pendingImport.habits.length} habit${
            pendingImport.habits.length === 1 ? '' : 's'
          } and ${pendingImport.todos.length} task${pendingImport.todos.length === 1 ? '' : 's'}`}
          title="Import this file?"
          description="will replace the habits and tasks on this device. A backup is saved first, so you can restore from this screen."
          cancelLabel="Cancel"
          confirmLabel="Import"
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        />
      )}
    </Portal>
  )
}
