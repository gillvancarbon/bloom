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

/**
 * The bottom bar. Two destinations, each a full-height tap target with its own
 * indicator: a small sage rule that grows in under the label, rather than a
 * pill filling the whole slot. The bar itself is a quiet surface with a single
 * hairline, so it frames the screen without competing with the content.
 */
export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Main sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-surface/95 backdrop-blur
                 supports-[backdrop-filter]:bg-surface/80"
    >
      <div
        role="tablist"
        className="mx-auto grid max-w-2xl grid-cols-2 px-6 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-3"
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
              className="relative flex flex-col items-center gap-1 py-1"
            >
              <Icon
                className={`h-[22px] w-[22px] transition-colors duration-calm ease-calm ${
                  active ? 'text-sage-700 dark:text-sage-300' : 'text-muted'
                }`}
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden
              />
              <span
                className={`text-[11px] font-medium leading-none transition-colors duration-calm ease-calm ${
                  active ? 'text-sage-700 dark:text-sage-200' : 'text-muted'
                }`}
              >
                {label}
              </span>
              <span className="absolute -bottom-1 flex h-1 justify-center">
                {active && (
                  <motion.span
                    layoutId="bloom-tab-rule"
                    className="h-1 w-6 rounded-full bg-sage-500 dark:bg-sage-300"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
