import { APP_VERSION } from './appInfo'
import { SETTINGS_SCHEMA_VERSION } from '../data/migrations'

/**
 * A support-friendly snapshot of the app's environment and how much data it is
 * holding. It deliberately contains no habit or task titles, notes or dates —
 * just counts and versions — so it is safe to paste into a bug report.
 */

export const DIAGNOSTICS_SCHEMA_VERSION = 1

export interface DiagnosticsInput {
  /** "local" (on-device) or "server" (REST backend). */
  dataMode: string
  habitCount: number
  todoCount: number
  /** Whether the platform supports native local notifications. */
  nativeNotifications: boolean
  remindersEnabled: boolean
  /** "granted", "denied", "prompt" or "unsupported". */
  notificationPermission: string
}

export interface Diagnostics extends DiagnosticsInput {
  app: 'Bloom'
  schemaVersion: number
  appVersion: string
  settingsSchemaVersion: number
  generatedAt: string
  platform: string
  locale: string
  timeZone: string
  userAgent: string
}

/** Build the diagnostics object. Kept pure so it is easy to test. */
export function buildDiagnostics(
  input: DiagnosticsInput,
  now: Date = new Date(),
  environment: { platform?: string; locale?: string; timeZone?: string; userAgent?: string } = {},
): Diagnostics {
  const timeZone =
    environment.timeZone ??
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        return 'unknown'
      }
    })()

  return {
    app: 'Bloom',
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    platform: environment.platform ?? 'web',
    locale:
      environment.locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'unknown'),
    timeZone,
    userAgent:
      environment.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
    ...input,
  }
}

export function diagnosticsToJson(diagnostics: Diagnostics): string {
  return `${JSON.stringify(diagnostics, null, 2)}\n`
}
