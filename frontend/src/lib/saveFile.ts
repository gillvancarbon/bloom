import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Save a text file for the user.
 *
 * The web build can hand the browser a normal download. A Capacitor WebView
 * ignores `<a download>`, so on Android the file is written to the app's cache
 * and passed to the system share sheet, where it can be saved to Files, Drive,
 * sent to yourself, and so on.
 *
 * Writing to public Downloads directly needs Android's MediaStore/SAF APIs;
 * the share sheet is the platform-standard way to let the user choose a
 * destination without asking for storage permission.
 */
export async function saveTextFile(
  filename: string,
  mimeType: string,
  content: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    try {
      await Share.share({
        title: filename,
        url: uri,
        dialogTitle: 'Save Bloom data',
      })
    } catch (err) {
      // Android reports a dismissed chooser as "Share canceled". Backing out
      // is a normal choice, not a failure worth an error toast.
      if (err instanceof Error && /cancel/i.test(err.message)) return
      throw err
    }
    return
  }

  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
