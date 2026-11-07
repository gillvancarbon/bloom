import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { BottomNav, type Tab } from './components/BottomNav'
import { HabitsView } from './components/HabitsView'
import { TodosView } from './components/TodosView'
import { SettingsView } from './components/SettingsView'
import { IntroFlow } from './components/IntroFlow'
import { TermsGate } from './components/TermsGate'
import { ToastHost } from './components/ToastHost'
import { useSettings } from './context/SettingsContext'
import { initReminderActions, syncTaskReminders } from './lib/notifications'
import { dataClient } from './data/dataClient'
import { onDataChanged } from './lib/dataEvents'

export default function App() {
  const { settings, ready, update } = useSettings()
  const [tab, setTab] = useState<Tab>('habits')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Set when the welcome tour asks for the habit templates, so the Habits
  // screen opens the picker as soon as it is showing.
  const [openTemplates, setOpenTemplates] = useState(false)
  // Calendar/Insights live on the Habits screen, but their shortcuts are on
  // every tab. Tapping them elsewhere switches to Habits and asks it to open.
  const [pendingOverlay, setPendingOverlay] = useState<'calendar' | 'insights' | null>(null)
  const settingsOpenRef = useRef(settingsOpen)
  settingsOpenRef.current = settingsOpen

  // A brand-new user must accept the Terms of Use before anything else; the
  // welcome tour follows once they do.
  const showTerms = ready && !settings.onboarded && !settings.termsAcceptedAt
  const showIntro = ready && !settings.onboarded && Boolean(settings.termsAcceptedAt)

  const finishIntro = useCallback(
    (wantsTemplates: boolean) => {
      update({ onboarded: true })
      if (wantsTemplates) {
        setTab('habits')
        setOpenTemplates(true)
      }
    },
    [update],
  )

  const templatesHandled = useCallback(() => setOpenTemplates(false), [])

  function changeTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Android hardware back: close Settings first, otherwise fall back to the
  // platform default (history back, then exit).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (settingsOpenRef.current) {
        setSettingsOpen(false)
        return
      }
      if (canGoBack) window.history.back()
      else CapacitorApp.exitApp()
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  // Register the reminder actions (Complete / Snooze) and their handler once.
  useEffect(() => {
    void initReminderActions()
  }, [])

  // Arm task reminders from the app root — not just from the To-do screen — so
  // an overdue task still nudges on a cold start that lands on Habits. Runs on
  // launch, whenever settings change, on the app returning to the foreground,
  // and after a background change (notification action, widget, import).
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const run = async () => {
      try {
        const { todos } = await dataClient.readAll()
        if (!cancelled) await syncTaskReminders(todos, settings)
      } catch {
        /* store not reachable yet — the next trigger will retry */
      }
    }
    void run()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const off = onDataChanged(() => void run())
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      off()
    }
  }, [ready, settings])

  return (
    <div className="bg-aura relative min-h-[100dvh]">
      <motion.div
        key={tab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-10"
      >
        {tab === 'habits' ? (
          <HabitsView
            onOpenSettings={() => setSettingsOpen(true)}
            autoOpenTemplates={openTemplates}
            onTemplatesHandled={templatesHandled}
            autoOpenOverlay={pendingOverlay}
            onOverlayHandled={() => setPendingOverlay(null)}
          />
        ) : (
          <TodosView
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCalendar={() => {
              setTab('habits')
              setPendingOverlay('calendar')
            }}
            onOpenInsights={() => {
              setTab('habits')
              setPendingOverlay('insights')
            }}
          />
        )}
      </motion.div>

      <BottomNav tab={tab} onChange={changeTab} />

      {/* Rendered directly (not via AnimatePresence): the dialog has no exit
          animation, and AnimatePresence could keep it mounted after a close. */}
      {settingsOpen && <SettingsView onClose={() => setSettingsOpen(false)} />}

      <AnimatePresence>{showTerms && <TermsGate />}</AnimatePresence>
      <AnimatePresence>{showIntro && <IntroFlow onFinish={finishIntro} />}</AnimatePresence>

      <ToastHost />
    </div>
  )
}
