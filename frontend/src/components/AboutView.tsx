import { useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ExternalLink,
  Github,
  Heart,
  Leaf,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import { Portal } from './Portal'
import { APP_VERSION, LINKS } from '../lib/appInfo'

interface AboutViewProps {
  onClose: () => void
}

function Card({
  Icon,
  title,
  children,
}: {
  Icon: typeof Leaf
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
      <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-sage-500 dark:text-sage-300" aria-hidden />
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  )
}

function ExternalLinkRow({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-calm-sm border border-line bg-surface px-3.5 py-3
                 transition-all duration-calm ease-calm hover:border-sage-300"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-sage-500 dark:text-sage-300" aria-hidden />
    </a>
  )
}

/**
 * The "About Bloom" screen from Settings. Keeps the plain-language privacy
 * summary and the legal links one tap away from the app itself.
 */
export function AboutView({ onClose }: AboutViewProps) {
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
          aria-labelledby="about-title"
        >
          <header className="mb-1 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close about"
              className="silicone flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div>
              <h1
                id="about-title"
                className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                About Bloom
              </h1>
              <p className="text-xs text-muted sm:text-sm">Version {APP_VERSION}</p>
            </div>
          </header>

          <div className="flex flex-col items-center rounded-calm border border-line bg-raised p-6 text-center shadow-calm">
            <span className="silicone-primary mb-3 flex h-16 w-16 items-center justify-center rounded-full">
              <Leaf className="h-8 w-8" aria-hidden />
            </span>
            <p className="font-display text-lg font-semibold text-ink">Bloom</p>
            <p className="mt-1 text-sm text-muted">Grow gently, one day at a time.</p>
          </div>

          <Card Icon={ShieldCheck} title="Your privacy">
            <p>
              Bloom keeps your habits, tasks and backups <strong>on your device</strong>. There is
              no account, no analytics, and no data sent to us. Uninstalling the app removes its
              data, so keep your own backups if it matters to you.
            </p>
            <ExternalLinkRow
              href={LINKS.privacy}
              label="Privacy policy"
              hint="What stays on your device"
            />
          </Card>

          <Card Icon={ScrollText} title="Terms & health">
            <p>
              Bloom is a wellbeing tool, <strong>not a medical device</strong>, and its reminders
              are best-effort. It is provided “as is”, without warranty.
            </p>
            <ExternalLinkRow href={LINKS.terms} label="Terms of use" hint="Use of the app" />
          </Card>

          <Card Icon={Github} title="Open source">
            <p>
              Bloom is free and open source under the MIT licence, built with React, Spring Boot and
              other open-source projects.
            </p>
            <ExternalLinkRow href={LINKS.repo} label="Source code" hint="View and contribute" />
            <ExternalLinkRow href={LINKS.license} label="MIT licence" hint="How you may reuse it" />
            <ExternalLinkRow
              href={LINKS.notices}
              label="Third-party notices"
              hint="Software and assets we build on"
            />
          </Card>

          <p className="flex items-center justify-center gap-1.5 pb-8 text-center text-xs text-muted">
            Made with{' '}
            <Heart className="h-3.5 w-3.5 text-peach-500 dark:text-peach-300" aria-hidden />
            in spare moments.
          </p>
        </motion.section>
      </motion.div>
    </Portal>
  )
}
