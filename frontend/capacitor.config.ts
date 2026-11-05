import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bloom.habittracker',
  appName: 'Bloom',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
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
