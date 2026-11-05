import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { BottomNav, type Tab } from './components/BottomNav'
import { HabitsView } from './components/HabitsView'
import { TodosView } from './components/TodosView'
import { SettingsView } from './components/SettingsView'
import { IntroFlow } from './components/IntroFlow'
import { useSettings } from './context/SettingsContext'
import { initReminderActions } from './lib/notifications'

export default function App() {
  const { settings, ready, update } = useSettings()
  const [tab, setTab] = useState<Tab>('habits')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Set when the welcome tour asks for the habit templates, so the Habits
  // screen opens the picker as soon as it is showing.
  const [openTemplates, setOpenTemplates] = useState(false)
  const settingsOpenRef = useRef(settingsOpen)
  settingsOpenRef.current = settingsOpen

  const showIntro = ready && !settings.onboarded

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
          />
        ) : (
          <TodosView onOpenSettings={() => setSettingsOpen(true)} />
        )}
      </motion.div>

      <BottomNav tab={tab} onChange={changeTab} />

      <AnimatePresence>
        {settingsOpen && <SettingsView onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>{showIntro && <IntroFlow onFinish={finishIntro} />}</AnimatePresence>
    </div>
  )
}
