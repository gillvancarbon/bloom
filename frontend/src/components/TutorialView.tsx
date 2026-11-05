import { useEffect, type ComponentType, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  Flame,
  Hand,
  Layers,
  ListTodo,
  Plus,
  Repeat,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { Portal } from './Portal'
import { FrozenFlame } from './FrozenFlame'

interface TutorialViewProps {
  onClose: () => void
}

/** Any icon that takes a size class — lucide glyphs or the frozen flame. */
type GuideIcon = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

interface Step {
  Icon: GuideIcon
  title: string
  body: string
}

interface GuideGroup {
  title: string
  steps: Step[]
}

/**
 * The step-by-step guide behind Settings → How to use Bloom. Written as plain
 * language so it doubles as an in-app manual: every screen and gesture the app
 * offers is described in the order a new user would meet it.
 */
const GROUPS: GuideGroup[] = [
  {
    title: 'Getting around',
    steps: [
      {
        Icon: Layers,
        title: 'Two calm spaces',
        body: 'Habits and To-do are the two full-width buttons pinned to the bottom of the screen. Tap to switch — the louder work never hides the quiet work.',
      },
      {
        Icon: Settings,
        title: 'Open Settings',
        body: 'Tap the Bloom leaf in the top-left corner of either screen. Reminders, sounds, theme, backups and this guide all live there.',
      },
    ],
  },
  {
    title: 'Habits',
    steps: [
      {
        Icon: Plus,
        title: 'Add a habit',
        body: 'Tap Add habit to name it, choose a part of the day, a deadline and how often it repeats. In a hurry? Tap Templates (beside Add habit) and pick a few ready-made habits.',
      },
      {
        Icon: Check,
        title: 'Check it off',
        body: 'Tap the circle on a card to mark it done for the day; tap again to undo. A gentle ding plays, and the card settles into Done.',
      },
      {
        Icon: Flame,
        title: 'Build a streak',
        body: 'Each day you complete a habit grows its flame. Miss one day and the flame shrinks but survives; miss a second day in a row and the streak resets.',
      },
      {
        Icon: FrozenFlame,
        title: 'Protect a streak',
        body: 'The frozen-flame token (left of Templates) holds three streak freezes a week. Open it and spend one on a habit with a missed day to keep the streak alive.',
      },
      {
        Icon: Clock,
        title: 'Plan your day',
        body: 'Habits are grouped into Morning, Afternoon, Evening and Anytime. Tap a chip, or swipe left and right, to move between them. Each chip shows done/total and flags overdue work.',
      },
      {
        Icon: Hand,
        title: 'Edit, reorder and tidy',
        body: 'Press and hold a card, then drag to reorder. Tap the leaf on a card for edit, archive and delete. Off-schedule habits — an off-day or a weekly habit already met — gather under a collapsible Not today section.',
      },
    ],
  },
  {
    title: 'To-do list',
    steps: [
      {
        Icon: ListTodo,
        title: 'Add a task',
        body: 'Give it a category and a priority, add an optional note, and set a due date and time if it matters. Tasks are ordered by due slot, with higher priority floating up.',
      },
      {
        Icon: Sparkles,
        title: 'Quick add',
        body: 'Type a sentence like “call mum tomorrow 6pm” in the quick-add line. Bloom reads the date, time, priority (!high), type (#work) and repeat (every monday), and previews it before you add the task.',
      },
      {
        Icon: Check,
        title: 'Views, steps and repeats',
        body: 'Switch between Today, Upcoming, Anytime and All, sort by due date, priority or name, and search by title or step. A task can hold a checklist and repeat daily, weekly or monthly — completing a repeating task moves it to its next turn.',
      },
      {
        Icon: ListTodo,
        title: 'Finish and undo',
        body: 'Tap the circle to complete a task — it moves into Done today, where you can still undo it. Overdue tasks offer a one-tap “Move to today”, and deleting shows a short undo toast in case of a slip.',
      },
    ],
  },
  {
    title: 'Insight and reminders',
    steps: [
      {
        Icon: CalendarDays,
        title: 'See your consistency',
        body: 'The calendar icon opens a month view: green days when everything was done, amber when some was, and red when none was. Months slide smoothly as you browse.',
      },
      {
        Icon: BarChart3,
        title: 'Look back gently',
        body: 'The trend icon opens Insights: this week’s review, weekly and monthly rates, a 30-day trend, and a per-habit heatmap with milestone badges.',
      },
      {
        Icon: Bell,
        title: 'Let Bloom nudge you',
        body: 'In Settings → Reminders, turn on daily reminders and choose a default reminder time (each habit can override it). Reminders carry Complete and Snooze buttons; a separate switch covers task reminders.',
      },
      {
        Icon: Target,
        title: 'Tune the details',
        body: 'Follow the clock, hide completed habits, pick a sort order, choose 12/24-hour time, set your week start, and choose the reminder and completion sounds — all in Settings.',
      },
    ],
  },
  {
    title: 'Your data',
    steps: [
      {
        Icon: ShieldCheck,
        title: 'Private, and backed up',
        body: 'Everything is stored on your device — nothing is sent anywhere. Bloom takes a daily automatic backup you can restore, or make a fresh one any time, from Settings → Data & backups.',
      },
      {
        Icon: Repeat,
        title: 'Still learning?',
        body: 'You can replay the welcome tour from Settings → Help whenever you like.',
      },
    ],
  },
]

function StepRow({ number, step }: { number: number; step: Step }) {
  return (
    <li className="flex gap-3 rounded-calm-sm border border-line bg-surface p-3.5">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-sage-600 dark:bg-mint-900/50 dark:text-sage-300">
        <step.Icon className="h-4 w-4" aria-hidden />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sage-500 text-[10px] font-bold text-white">
          {number}
        </span>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{step.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{step.body}</p>
      </div>
    </li>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
      <h2 className="mb-3 font-display text-sm font-semibold text-ink">{title}</h2>
      <ol className="space-y-2">{children}</ol>
    </section>
  )
}

/**
 * Full-screen "How to use Bloom" guide. Reached from Settings, and safe to open
 * over it — it renders in its own portal layer above Settings.
 */
export function TutorialView({ onClose }: TutorialViewProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-[55] overflow-y-auto bg-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="safe-shell relative mx-auto flex min-h-full max-w-xl flex-col gap-4 px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
        >
          <header className="mb-1 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tutorial"
              className="silicone flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div>
              <h1
                id="tutorial-title"
                className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                How to use Bloom
              </h1>
              <p className="text-xs text-muted sm:text-sm">
                <Sparkles className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />A
                two-minute tour of everything in the app.
              </p>
            </div>
          </header>

          {GROUPS.map((group, groupIndex) => (
            <Group key={group.title} title={group.title}>
              {group.steps.map((step, stepIndex) => {
                // Keep one continuous count across the whole guide.
                const before = GROUPS.slice(0, groupIndex).reduce(
                  (sum, g) => sum + g.steps.length,
                  0,
                )
                return <StepRow key={step.title} number={before + stepIndex + 1} step={step} />
              })}
            </Group>
          ))}

          <p className="pb-8 text-center text-xs text-muted">
            Bloom · stored privately on this device.
          </p>
        </motion.section>
      </motion.div>
    </Portal>
  )
}
