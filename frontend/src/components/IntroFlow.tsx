import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Flame, Layers, Leaf, Sparkles } from 'lucide-react'
import { Portal } from './Portal'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface IntroFlowProps {
  /** Called once the tour ends. `openTemplates` asks for the habit templates. */
  onFinish: (openTemplates: boolean) => void
}

interface Slide {
  Icon: typeof Leaf
  title: string
  body: string
}

/**
 * The slides are deliberately short — one idea each — so a brand-new user can
 * tap through in a few seconds and land on the Habits screen ready to add a
 * habit. A "Skip" is always one tap away.
 */
const SLIDES: Slide[] = [
  {
    Icon: Leaf,
    title: 'Welcome to Bloom',
    body: 'A calm place to grow habits and keep a gentle to-do list. Everything stays on your device — no account, no noise.',
  },
  {
    Icon: Flame,
    title: 'Build gentle streaks',
    body: 'Check a habit off each day to build momentum. Miss a day and a one-day grace keeps it going, so a single slip won’t undo your progress.',
  },
  {
    Icon: Layers,
    title: 'Tasks and quick-add',
    body: 'Your to-dos live in the second tab. Type a sentence like “call mum tomorrow 6pm” and quick-add fills in the details for you.',
  },
]

const slideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 26 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -26 }),
}

/**
 * The first-run welcome tour. Shown once (until Settings → Show the welcome
 * tour again), it introduces habits, streaks and tasks in three short slides,
 * and ends by offering the habit templates.
 */
export function IntroFlow({ onFinish }: IntroFlowProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const trapRef = useFocusTrap<HTMLDivElement>()

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish(false)
      if (e.key === 'ArrowRight' && !isLast) go(1)
      if (e.key === 'ArrowLeft' && index > 0) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, isLast, onFinish])

  function go(delta: number) {
    setDirection(delta)
    setIndex((prev) => Math.min(SLIDES.length - 1, Math.max(0, prev + delta)))
  }

  return (
    <Portal>
      <motion.div
        ref={trapRef}
        className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Bloom"
      >
        <div className="safe-shell relative mx-auto flex min-h-full w-full max-w-md flex-col px-6">
          {/* Top bar */}
          <header className="flex items-center justify-between pt-5">
            <div className="flex items-center gap-2.5">
              <span className="silicone-primary flex h-10 w-10 items-center justify-center rounded-full">
                <Leaf className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-display text-base font-semibold text-ink">Bloom</span>
            </div>
            {!isLast && (
              <button
                type="button"
                onClick={() => onFinish(false)}
                className="silicone-quiet rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
              >
                Skip
              </button>
            )}
          </header>

          {/* Slide */}
          <div className="flex flex-1 items-center">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={index}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                className="w-full text-center"
              >
                <span className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-mint-100 text-sage-500 shadow-calm dark:bg-mint-900/50 dark:text-sage-300">
                  <slide.Icon className="h-11 w-11" aria-hidden />
                </span>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
                  {slide.title}
                </h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  {slide.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <footer className="pb-8">
            <div className="mb-5 flex items-center justify-center gap-1.5" aria-hidden>
              {SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-calm ease-calm ${
                    i === index ? 'w-6 bg-sage-400' : 'w-1.5 bg-mint-300 dark:bg-mint-800'
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-center text-xs leading-relaxed text-muted">
                  Start with one or two. You can always add more.
                </p>
                <button
                  type="button"
                  onClick={() => onFinish(true)}
                  className="silicone-primary inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Pick starter habits
                </button>
                <button
                  type="button"
                  onClick={() => onFinish(false)}
                  className="silicone-quiet rounded-full px-5 py-3 text-sm font-medium text-muted hover:text-ink"
                >
                  Explore on my own
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => go(1)}
                className="silicone-primary inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </footer>
        </div>
      </motion.div>
    </Portal>
  )
}
