import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bloom.habittracker',
  appName: 'Bloom',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    // Work around a Capacitor Android bridge bug that can leave a native
    // write committed while its JS promise stays unsettled — the form sits on
    // "Saving…" although the habit or task was created. The legacy bridge
    // avoids the affected reply-proxy path. See ionic-team/capacitor#8616.
    useLegacyBridge: true,
  },
  plugins: {
    LocalNotifications: {
      // Monochrome status-bar icon, tinted by the system.
      smallIcon: 'ic_stat_bloom',
      iconColor: '#4A7C59',
      // Gentle chime bundled at android/app/src/main/res/raw/bloom_chime.wav.
      // Also seeds the plugin's own default channel with a real sound.
      sound: 'bloom_chime',
    },
  },
}

export default config
