import { motion } from 'framer-motion'
import { Leaf, ListTodo, type LucideIcon } from 'lucide-react'

export type Tab = 'habits' | 'todos'

interface BottomNavProps {
  tab: Tab
  onChange: (tab: Tab) => void
}

const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'habits', label: 'Habits', icon: Leaf },
  { id: 'todos', label: 'To-do', icon: ListTodo },
]

export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Main sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-raised shadow-[0_-10px_30px_-18px_rgb(var(--shadow)/0.35)]"
    >
      <div
        role="tablist"
        className="mx-auto grid max-w-2xl grid-cols-2 px-2 pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2.5"
            >
              {active && (
                <motion.span
                  layoutId="bloom-tab-pill"
                  className="absolute inset-x-3 inset-y-1 rounded-calm-sm bg-mint-100 dark:bg-mint-900/60"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 flex flex-col items-center gap-0.5 text-[11px] font-medium transition-colors duration-calm ease-calm ${
                  active ? 'text-sage-600 dark:text-sage-300' : 'text-muted'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
