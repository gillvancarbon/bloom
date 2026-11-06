import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Leaf, ScrollText, ShieldCheck } from 'lucide-react'
import { Portal } from './Portal'
import { useSettings } from '../context/SettingsContext'
import { exitApp } from '../lib/appControl'
import { LINKS } from '../lib/appInfo'
import { TERMS_SECTIONS, TERMS_SUMMARY, TERMS_UPDATED, TERMS_VERSION } from '../lib/legal'

/**
 * A hard gate shown to a brand-new user before the app is usable. The only way
 * past it is to read the terms and tick the box; declining (or pressing Escape)
 * closes the app. There is deliberately no backdrop tap, close button or skip.
 */
export function TermsGate() {
  const { update } = useSettings()
  const [agreed, setAgreed] = useState(false)
  const [declined, setDeclined] = useState(false)

  function accept() {
    if (!agreed) return
    update({ termsAcceptedAt: new Date().toISOString() })
  }

  async function decline() {
    setDeclined(true)
    await exitApp()
  }

  // Escape counts as a refusal; the app closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void decline()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (declined) {
    return (
      <Portal>
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-page px-8 text-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="terms-declined-title"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mint-100 text-sage-500 dark:bg-mint-900/50 dark:text-sage-300">
            <Leaf className="h-8 w-8" aria-hidden />
          </span>
          <h1
            id="terms-declined-title"
            className="font-display text-xl font-semibold tracking-tight text-ink"
          >
            Thanks for stopping by
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Bloom needs your agreement to the Terms of Use before it can run. The app is closing
            now. You can close this tab if it stays open.
          </p>
        </div>
      </Portal>
    )
  }

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        aria-describedby="terms-summary"
      >
        <div className="safe-shell relative mx-auto flex min-h-full w-full max-w-md flex-col px-6">
          <header className="flex items-center gap-2.5 pt-6">
            <span className="silicone-primary flex h-10 w-10 items-center justify-center rounded-full">
              <Leaf className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-display text-base font-semibold text-ink">Bloom</span>
          </header>

          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint-100 text-sage-500 dark:bg-mint-900/50 dark:text-sage-300">
              <ScrollText className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1
                id="terms-title"
                className="font-display text-xl font-semibold tracking-tight text-ink"
              >
                Terms of Use
              </h1>
              <p className="text-xs text-muted">
                Version {TERMS_VERSION} · updated {TERMS_UPDATED}
              </p>
            </div>
          </div>

          <p id="terms-summary" className="mt-3 text-sm leading-relaxed text-muted">
            {TERMS_SUMMARY}
          </p>

          <div className="mt-4 space-y-4 rounded-calm border border-line bg-raised p-4 shadow-calm">
            {TERMS_SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-1 text-sm leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
            <a
              href={LINKS.privacy}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage-600 hover:underline dark:text-sage-300"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Read the full Privacy Policy
            </a>
          </div>

          <div className="mt-4 pb-8">
            <label className="flex cursor-pointer items-start gap-3 rounded-calm border border-line bg-surface p-3.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line
                           bg-raised text-transparent transition-colors duration-calm
                           peer-checked:border-sage-500 peer-checked:bg-sage-500 peer-checked:text-white
                           peer-focus-visible:ring-2 peer-focus-visible:ring-sage-400/50"
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm text-ink">
                I have read and agree to the <strong>Terms of Use</strong> and the{' '}
                <strong>Privacy Policy</strong>.
              </span>
            </label>

            <button
              type="button"
              onClick={accept}
              disabled={!agreed}
              className="silicone-primary mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-3
                         text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Agree and continue
            </button>
            <button
              type="button"
              onClick={() => void decline()}
              className="silicone-quiet mt-2 w-full rounded-full px-5 py-3 text-sm font-medium text-muted hover:text-ink"
            >
              Decline and close
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              You must agree to use Bloom. Declining closes the app.
            </p>
          </div>
        </div>
      </motion.div>
    </Portal>
  )
}
