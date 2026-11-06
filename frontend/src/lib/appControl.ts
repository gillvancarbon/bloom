import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

/**
 * Close the app. Used when a new user declines the Terms of Use.
 *
 * On Android this exits the process. On the web a page can only close itself if
 * a script opened it, so this is best-effort — the gate keeps a "closed" screen
 * for whenever `window.close()` is refused.
 */
export async function exitApp(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await CapacitorApp.exitApp()
      return
    } catch {
      /* fall through to the web attempt */
    }
  }
  try {
    window.close()
  } catch {
    /* browsers usually refuse this for tabs they didn't open */
  }
}
