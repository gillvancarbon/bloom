import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Settings, SoundChoice } from '../types'

/**
 * Sound bridge.
 *
 * Device notification ringtones (content://… URIs) can't be used by the stock
 * LocalNotifications plugin — its channel sound must be a bundled `res/raw`
 * file. So a tiny native plugin owns the Android notification channel and can
 * play any chosen sound. Everything here is a no-op on the web.
 */

export interface SoundOption {
  /** `bloom_chime`, `default`, `none`, or a ringtone URI. */
  id: string
  title: string
}

interface BloomSoundPlugin {
  listSounds(): Promise<{ sounds: SoundOption[] }>
  play(options: { id: string }): Promise<void>
  getChannelId(options: { sound: string }): Promise<{ channelId: string }>
  setReminderSound(options: { sound: string }): Promise<{ channelId: string }>
}

const BloomSound = registerPlugin<BloomSoundPlugin>('BloomSound')

/** Fallback used on the web and if the plugin is missing. */
const FALLBACK_CHANNEL_ID = 'bloom-reminders-v3'

export function soundSupported(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/** The bundled chime, phone default, none, then every notification ringtone. */
export async function listSounds(): Promise<SoundOption[]> {
  if (!soundSupported()) return []
  try {
    const { sounds } = await BloomSound.listSounds()
    return sounds
  } catch {
    return []
  }
}

/** Play a sound once — used for previews and the in-app completion ding. */
export async function playSound(id: string): Promise<void> {
  if (!soundSupported() || !id) return
  try {
    await BloomSound.play({ id })
  } catch {
    /* no sound available */
  }
}

/** Ensure the reminder channel matches the chosen sound; returns its id. */
export async function getReminderChannelId(sound: SoundChoice): Promise<string> {
  if (!soundSupported()) return FALLBACK_CHANNEL_ID
  try {
    const { channelId } = await BloomSound.getChannelId({ sound })
    return channelId
  } catch {
    return FALLBACK_CHANNEL_ID
  }
}

/** Persist the reminder sound and rebuild the (immutable) Android channel. */
export async function applyReminderSound(sound: SoundChoice): Promise<void> {
  if (!soundSupported()) return
  try {
    await BloomSound.setReminderSound({ sound })
  } catch {
    /* ignore */
  }
}

/** Resolve which sound the completion ding should play, or null for silence. */
export function completionSoundId(settings: Settings): string | null {
  const choice = settings.completionSound
  const id = choice === 'same' ? settings.reminderSound : choice
  return id === 'none' ? null : id
}

/** Play the chosen completion ding, unless the user picked None. */
export async function playCompletionSound(settings: Settings): Promise<void> {
  const id = completionSoundId(settings)
  if (!id) return
  await playSound(id)
}
