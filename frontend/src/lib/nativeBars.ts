import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Colours the Android system bars (navigation bar, and the status bar via the
 * stock plugin) so they blend with the app background instead of flashing
 * white on launch or theme switch.
 *
 * On the web this is a no-op — everything is guarded by `isNativePlatform()`.
 */

type Theme = 'light' | 'dark'

/** Matches the `--page` token in index.css (246 249 246 / 18 22 19). */
export const PAGE_COLOR: Record<Theme, string> = {
  light: '#F6F9F6',
  dark: '#121613',
}

interface BloomBarsPlugin {
  /** Set the navigation-bar background colour and its icon tint. */
  setNavigationBar(options: { color: string; light: boolean }): Promise<void>
}

const BloomBars = registerPlugin<BloomBarsPlugin>('BloomBars')

/**
 * Paint the Android navigation bar to match `theme`.
 * `light` here means "use dark icons", i.e. a light background.
 */
export async function syncNavigationBar(theme: Theme): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await BloomBars.setNavigationBar({
      color: PAGE_COLOR[theme],
      light: theme === 'light',
    })
  } catch {
    // Older devices / platforms without the plugin — the theme still applies.
  }
}
