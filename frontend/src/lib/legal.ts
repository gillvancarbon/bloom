/**
 * The Terms of Use shown to a brand-new user before the app opens, and again
 * from Settings → About. Kept in one place so the gate and About can never drift
 * apart. Plain language on purpose — a new user should be able to read the whole
 * thing in about a minute.
 */

export const TERMS_VERSION = '1.0'
export const TERMS_UPDATED = '6 November 2026'

export interface TermsSection {
  title: string
  paragraphs: string[]
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Accepting these terms',
    paragraphs: [
      'By ticking the box and continuing, you agree to these Terms of Use and to the Privacy Policy. If you do not agree, the app will close and you will not be able to use it.',
      'You must be old enough to enter into this agreement where you live.',
    ],
  },
  {
    title: '2. Licence and permitted use',
    paragraphs: [
      'Bloom is released under the PolyForm Noncommercial License 1.0.0. It is free for personal, noncommercial use.',
      'You may not sell Bloom, charge for it, or redistribute it commercially. The full licence is the legal agreement and is available in the project repository.',
    ],
  },
  {
    title: '3. Not medical advice',
    paragraphs: [
      'Bloom is a wellbeing and productivity tool. It is not a medical device and it does not provide medical, mental-health, or professional advice.',
      'Do not rely on Bloom for anything time-critical or safety-related. Reminders are best-effort and may be delayed or missed by the operating system.',
    ],
  },
  {
    title: '4. Your data and backups',
    paragraphs: [
      'Habits, tasks, settings and backups are kept on your device. There is no account and nothing is sent to us.',
      'You are responsible for your own data. Uninstalling the app or clearing its data removes everything, so keep your own copies if it matters to you. The in-app export and backup tools are there to help.',
    ],
  },
  {
    title: '5. Provided “as is”',
    paragraphs: [
      'Bloom is provided “as is”, without warranties of any kind, whether express or implied, including fitness for a particular purpose.',
      'To the fullest extent permitted by law, the authors are not liable for any loss or damage arising from your use of, or inability to use, the app.',
    ],
  },
  {
    title: '6. Changes',
    paragraphs: [
      'These terms may be updated over time. The current version always lives in the project repository. Continued use after an update means you accept the new terms.',
    ],
  },
]

/** A short line for summaries in About and the gate. */
export const TERMS_SUMMARY =
  'Free for personal, noncommercial use · not a medical device · your data stays on your device · provided “as is”.'
